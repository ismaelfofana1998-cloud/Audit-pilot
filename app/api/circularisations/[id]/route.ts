import {
  apiError,
  getDb,
  getMissionPermission,
  logActivity,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function PATCH(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  try {
    const actor = await requireApiActor();
    const { id } = await context.params;
    const payload = (await request.json()) as {
      status?: string;
      nextFollowUpAt?: string;
      alternativeProcedure?: string;
      evidenceLink?: string;
      notes?: string;
    };
    const statuses = new Set([
      "draft",
      "sent",
      "follow_up_1",
      "follow_up_2",
      "no_response",
      "response_received",
      "alternative_procedure",
      "closed",
    ]);
    if (payload.status && !statuses.has(payload.status)) {
      return Response.json({ error: "Statut invalide." }, { status: 400 });
    }
    const db = await getDb();
    const item = await db
      .prepare(
        `SELECT mission_id AS missionId, owner_user_id AS ownerUserId
         FROM circularisations
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, actor.tenantId)
      .first<{ missionId: string; ownerUserId: string | null }>();
    if (!item) {
      return Response.json(
        { error: "Circularisation introuvable." },
        { status: 404 },
      );
    }
    const permission = await getMissionPermission(actor, item.missionId);
    if (!permission?.canManage && item.ownerUserId !== actor.userId) {
      return Response.json(
        { error: "Seul le responsable ou le pilote de la circularisation peut la modifier." },
        { status: 403 },
      );
    }
    const now = new Date().toISOString();
    await db
      .prepare(
        `UPDATE circularisations SET
           status = COALESCE(?, status),
           next_follow_up_at = COALESCE(?, next_follow_up_at),
           alternative_procedure = COALESCE(?, alternative_procedure),
           evidence_link = COALESCE(?, evidence_link),
           notes = COALESCE(?, notes),
           sent_at = CASE WHEN ? = 'sent' AND sent_at IS NULL THEN ? ELSE sent_at END,
           response_at = CASE WHEN ? = 'response_received' THEN ? ELSE response_at END,
           updated_at = ?
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(
        payload.status || null,
        payload.nextFollowUpAt || null,
        payload.alternativeProcedure === undefined
          ? null
          : payload.alternativeProcedure.trim(),
        payload.evidenceLink === undefined ? null : payload.evidenceLink.trim(),
        payload.notes === undefined ? null : payload.notes.trim(),
        payload.status || null,
        now,
        payload.status || null,
        now,
        now,
        id,
        actor.tenantId,
      )
      .run();
    await logActivity(actor, {
      missionId: item.missionId,
      entityType: "circularisation",
      entityId: id,
      action: payload.status ? `status:${payload.status}` : "updated",
      detail: payload.notes ?? null,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
