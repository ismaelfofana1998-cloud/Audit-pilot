import {
  apiError,
  getMissionPermission,
  getDb,
  logActivity,
  makeId,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiActor();
    const { id: missionId } = await context.params;
    const permission = await getMissionPermission(actor, missionId);
    if (!permission) {
      return Response.json({ error: "Mission introuvable." }, { status: 404 });
    }
    if (!permission.canManage) {
      return Response.json(
        { error: "Seul le responsable de mission peut créer et affecter les tests." },
        { status: 403 },
      );
    }
    const payload = (await request.json()) as {
      cycleId?: string;
      code?: string;
      title?: string;
      objective?: string;
      instructions?: string;
      assertion?: string;
      assignedToUserId?: string;
      reviewerUserId?: string;
      dueDate?: string;
    };
    const cycleId = payload.cycleId?.trim() ?? "";
    const code = payload.code?.trim().toUpperCase() ?? "";
    const title = payload.title?.trim() ?? "";
    if (!cycleId || !code || !title) {
      return Response.json(
        { error: "Cycle, code et intitulé du test sont requis." },
        { status: 400 },
      );
    }
    if (
      payload.assignedToUserId &&
      payload.reviewerUserId &&
      payload.assignedToUserId === payload.reviewerUserId
    ) {
      return Response.json(
        { error: "Le préparateur et le relecteur doivent être distincts." },
        { status: 409 },
      );
    }
    const db = await getDb();
    const cycle = await db
      .prepare(
        `SELECT id FROM audit_cycles
         WHERE id = ? AND mission_id = ? AND tenant_id = ?`,
      )
      .bind(cycleId, missionId, actor.tenantId)
      .first();
    if (!cycle) {
      return Response.json({ error: "Cycle introuvable." }, { status: 404 });
    }
    const assignedUsers = [
      payload.assignedToUserId,
      payload.reviewerUserId,
    ].filter(Boolean) as string[];
    if (assignedUsers.length) {
      const placeholders = assignedUsers.map(() => "?").join(",");
      const allowed = await db
        .prepare(
          `SELECT user_id AS userId, professional_grade AS grade
           FROM memberships
           WHERE tenant_id = ? AND status = 'active'
             AND user_id IN (${placeholders})`,
        )
        .bind(actor.tenantId, ...assignedUsers)
        .all<{ userId: string; grade: string }>();
      if (allowed.results.length !== new Set(assignedUsers).size) {
        return Response.json(
          { error: "Un collaborateur sélectionné n’appartient pas au cabinet." },
          { status: 403 },
        );
      }
      if (payload.reviewerUserId) {
        const reviewer = allowed.results.find(
          (item) => item.userId === payload.reviewerUserId,
        );
        if (!reviewer || !["partner", "manager", "senior"].includes(reviewer.grade)) {
          return Response.json(
            { error: "Le relecteur doit être associé, manager ou senior." },
            { status: 409 },
          );
        }
      }
    }
    const procedureId = makeId("procedure");
    const testId = makeId("test");
    const statements = [
      db
        .prepare(
          `INSERT INTO audit_procedures
            (id, tenant_id, mission_id, cycle_id, code, title, objective, assertion)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          procedureId,
          actor.tenantId,
          missionId,
          cycleId,
          `PROC-${code}`,
          title,
          payload.objective?.trim() ?? "",
          payload.assertion?.trim() || null,
        ),
      db
        .prepare(
          `INSERT INTO audit_tests
            (id, tenant_id, mission_id, cycle_id, procedure_id, code, title,
             instructions, assigned_to_user_id, reviewer_user_id, due_date)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          testId,
          actor.tenantId,
          missionId,
          cycleId,
          procedureId,
          code,
          title,
          payload.instructions?.trim() ?? "",
          payload.assignedToUserId || null,
          payload.reviewerUserId || null,
          payload.dueDate || null,
        ),
    ];
    for (const userId of assignedUsers) {
      const membership = await db
        .prepare(
          `SELECT professional_grade AS grade FROM memberships
           WHERE tenant_id = ? AND user_id = ? AND status = 'active'`,
        )
        .bind(actor.tenantId, userId)
        .first<{ grade: string }>();
      statements.push(
        db
          .prepare(
            `INSERT INTO mission_team
              (id, tenant_id, mission_id, user_id, engagement_role,
               is_mission_lead, can_review)
             VALUES (?, ?, ?, ?, ?, 0, ?)
             ON CONFLICT(mission_id, user_id) DO NOTHING`,
          )
          .bind(
            makeId("team"),
            actor.tenantId,
            missionId,
            userId,
            membership?.grade ?? "junior",
            Number(
              userId === payload.reviewerUserId ||
                ["partner", "manager", "senior"].includes(
                  membership?.grade ?? "",
                ),
            ),
          ),
      );
    }
    await db.batch(statements);
    await logActivity(actor, {
      missionId,
      entityType: "test",
      entityId: testId,
      action: "created",
      detail: `${code} — ${title}`,
    });
    return Response.json({ testId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
