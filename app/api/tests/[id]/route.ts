import {
  apiError,
  getDb,
  logActivity,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

type TestUpdate = {
  assignedToUserId?: string | null;
  reviewerUserId?: string | null;
  dueDate?: string | null;
  title?: string;
  instructions?: string;
  conclusion?: string;
  evidenceLink?: string;
  comments?: string;
  preparationStatus?: string;
  reviewStatus?: string;
};

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiActor();
    const { id } = await context.params;
    const payload = (await request.json()) as TestUpdate;
    const db = await getDb();
    const test = await db
      .prepare(
        `SELECT at.id, at.mission_id AS missionId,
                at.assigned_to_user_id AS assignedTo,
                at.reviewer_user_id AS reviewer,
                at.prepared_by_user_id AS preparedBy,
                COALESCE(at.conclusion, '') AS conclusion,
                COALESCE(at.evidence_link, '') AS evidenceLink,
                at.preparation_status AS preparationStatus,
                at.review_status AS reviewStatus,
                EXISTS (
                  SELECT 1 FROM mission_team mt
                  WHERE mt.tenant_id = at.tenant_id
                    AND mt.mission_id = at.mission_id
                    AND mt.user_id = ?
                    AND (mt.is_mission_lead = 1 OR mt.can_review = 1)
                ) AS hasMissionAuthority
         FROM audit_tests at
         WHERE at.id = ? AND at.tenant_id = ?`,
      )
      .bind(actor.userId, id, actor.tenantId)
      .first<{
        id: string;
        missionId: string;
        assignedTo: string | null;
        reviewer: string | null;
        preparedBy: string | null;
        conclusion: string;
        evidenceLink: string;
        preparationStatus: string;
        reviewStatus: string;
        hasMissionAuthority: number;
      }>();
    if (!test) {
      return Response.json({ error: "Test introuvable." }, { status: 404 });
    }

    const elevated =
      ["owner", "admin"].includes(actor.accessRole) ||
      Boolean(test.hasMissionAuthority);
    const canPrepare = test.assignedTo === actor.userId || elevated;
    const canReview = test.reviewer === actor.userId || elevated;
    const assignmentChanged =
      "assignedToUserId" in payload || "reviewerUserId" in payload;
    const metadataChanged =
      assignmentChanged ||
      "dueDate" in payload ||
      "title" in payload ||
      "instructions" in payload;
    if (metadataChanged && !elevated) {
      return Response.json(
        { error: "Seul le responsable de mission peut modifier l’affectation." },
        { status: 403 },
      );
    }
    const nextAssignee =
      payload.assignedToUserId === undefined
        ? test.assignedTo
        : payload.assignedToUserId || null;
    const nextReviewer =
      payload.reviewerUserId === undefined
        ? test.reviewer
        : payload.reviewerUserId || null;
    const selectedUsers = [nextAssignee, nextReviewer].filter(Boolean) as string[];
    if (selectedUsers.length) {
      const placeholders = selectedUsers.map(() => "?").join(",");
      const allowed = await db
        .prepare(
          `SELECT m.user_id AS userId, m.professional_grade AS grade,
                  COALESCE(mt.can_review, 0) AS canReview
           FROM memberships m
           LEFT JOIN mission_team mt
             ON mt.tenant_id = m.tenant_id AND mt.mission_id = ?
            AND mt.user_id = m.user_id
           WHERE m.tenant_id = ? AND m.status = 'active'
             AND m.user_id IN (${placeholders})`,
        )
        .bind(test.missionId, actor.tenantId, ...selectedUsers)
        .all<{ userId: string; grade: string; canReview: number }>();
      if (allowed.results.length !== new Set(selectedUsers).size) {
        return Response.json(
          { error: "Un collaborateur sélectionné n’appartient pas au cabinet." },
          { status: 403 },
        );
      }
      if (nextReviewer) {
        const reviewer = allowed.results.find((item) => item.userId === nextReviewer);
        if (
          !reviewer ||
          (!reviewer.canReview && !["partner", "manager", "senior"].includes(reviewer.grade))
        ) {
          return Response.json(
            { error: "Le relecteur sélectionné n’est pas autorisé à effectuer une revue." },
            { status: 409 },
          );
        }
      }
    }
    if (nextAssignee && nextReviewer && nextAssignee === nextReviewer) {
      return Response.json(
        { error: "Le préparateur et le relecteur doivent être distincts." },
        { status: 409 },
      );
    }
    if (
      ("conclusion" in payload ||
        "evidenceLink" in payload ||
        "preparationStatus" in payload) &&
      !canPrepare
    ) {
      return Response.json(
        { error: "Ce test n’est pas assigné à cet utilisateur." },
        { status: 403 },
      );
    }
    if (
      ("reviewStatus" in payload || "comments" in payload) &&
      !canReview
    ) {
      return Response.json(
        { error: "Vous n’êtes pas désigné comme relecteur." },
        { status: 403 },
      );
    }

    const now = new Date().toISOString();
    let preparationStatus =
      payload.preparationStatus ?? test.preparationStatus;
    let reviewStatus = payload.reviewStatus ?? test.reviewStatus;
    let preparedBy = test.preparedBy;
    let preparedAt: string | null = null;
    let reviewedAt: string | null = null;
    let reviewedBy: string | null = null;

    if (payload.preparationStatus === "submitted") {
      const nextConclusion = payload.conclusion?.trim() ?? test.conclusion;
      if (!nextReviewer || !nextConclusion) {
        return Response.json(
          { error: "Une conclusion et un relecteur sont requis avant la soumission." },
          { status: 409 },
        );
      }
      preparedBy = actor.userId;
      preparedAt = now;
      reviewStatus = "pending";
    }
    if (payload.preparationStatus === "completed") {
      return Response.json(
        { error: "Un test devient réalisé après validation de la revue." },
        { status: 409 },
      );
    }
    if (payload.reviewStatus && payload.reviewStatus !== "not_started") {
      if (preparedBy === actor.userId) {
        return Response.json(
          { error: "Le préparateur ne peut pas revoir son propre test." },
          { status: 409 },
        );
      }
      if (
        payload.reviewStatus !== "pending" &&
        test.preparationStatus !== "submitted"
      ) {
        return Response.json(
          { error: "Soumettez le test avant de conclure la revue." },
          { status: 409 },
        );
      }
      if (payload.reviewStatus === "changes_requested" && !payload.comments?.trim()) {
        return Response.json(
          { error: "Précisez les corrections demandées avant de renvoyer le test." },
          { status: 409 },
        );
      }
      reviewedAt = now;
      reviewedBy = actor.userId;
      if (payload.reviewStatus === "approved") preparationStatus = "completed";
      if (payload.reviewStatus === "changes_requested") {
        preparationStatus = "in_progress";
      }
    }

    await db
      .prepare(
        `UPDATE audit_tests SET
           assigned_to_user_id = ?,
           reviewer_user_id = ?,
           due_date = COALESCE(?, due_date),
           title = COALESCE(?, title),
           instructions = COALESCE(?, instructions),
           conclusion = COALESCE(?, conclusion),
           evidence_link = COALESCE(?, evidence_link),
           review_note = COALESCE(?, review_note),
           preparation_status = ?,
           review_status = ?,
           prepared_by_user_id = ?,
           prepared_at = COALESCE(?, prepared_at),
           reviewed_by_user_id = COALESCE(?, reviewed_by_user_id),
           reviewed_at = COALESCE(?, reviewed_at),
           updated_at = ?,
           version = version + 1
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(
        nextAssignee,
        nextReviewer,
        payload.dueDate === undefined ? null : payload.dueDate || null,
        payload.title?.trim() || null,
        payload.instructions?.trim() || null,
        payload.conclusion === undefined ? null : payload.conclusion.trim(),
        payload.evidenceLink === undefined ? null : payload.evidenceLink.trim(),
        payload.comments === undefined ? null : payload.comments.trim(),
        preparationStatus,
        reviewStatus,
        preparedBy,
        preparedAt,
        reviewedBy,
        reviewedAt,
        now,
        id,
        actor.tenantId,
      )
      .run();
    await logActivity(actor, {
      missionId: test.missionId,
      entityType: "test",
      entityId: id,
      action: payload.reviewStatus
        ? `review:${payload.reviewStatus}`
        : payload.preparationStatus
          ? `preparation:${payload.preparationStatus}`
          : assignmentChanged
            ? "assigned"
            : "updated",
      detail: payload.comments ?? payload.conclusion ?? null,
    });
    return Response.json({
      ok: true,
      preparationStatus,
      reviewStatus,
      updatedAt: now,
    });
  } catch (error) {
    return apiError(error);
  }
}
