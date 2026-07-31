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
      emailLink?: string;
      documentLink?: string;
      notes?: string;
      dueDate?: string;
    };
    const allowedStatuses = new Set([
      "draft",
      "sent",
      "partially_received",
      "received",
      "validated",
      "closed",
    ]);
    if (payload.status && !allowedStatuses.has(payload.status)) {
      return Response.json({ error: "Statut invalide." }, { status: 400 });
    }
    const db = await getDb();
    const existing = await db
      .prepare(
        `SELECT mission_id AS missionId, owner_user_id AS ownerUserId, status
         FROM client_requests
         WHERE id = ? AND tenant_id = ?`,
      )
      .bind(id, actor.tenantId)
      .first<{ missionId: string; ownerUserId: string | null; status: string }>();
    if (!existing) {
      return Response.json({ error: "Demande introuvable." }, { status: 404 });
    }
    const permission = await getMissionPermission(actor, existing.missionId);
    if (
      !permission?.canManage &&
      existing.ownerUserId !== actor.userId
    ) {
      return Response.json(
        { error: "Seul le responsable ou le pilote de la demande peut la modifier." },
        { status: 403 },
      );
    }
    const now = new Date().toISOString();
    await db.batch([
      db
        .prepare(
          `UPDATE client_requests SET
             status = COALESCE(?, status),
             email_link = COALESCE(?, email_link),
             document_link = COALESCE(?, document_link),
             notes = COALESCE(?, notes),
             due_date = COALESCE(?, due_date),
             sent_at = CASE WHEN ? = 'sent' AND sent_at IS NULL THEN ? ELSE sent_at END,
             received_at = CASE WHEN ? IN ('received', 'validated', 'closed') THEN ? ELSE received_at END,
             updated_at = ?
           WHERE id = ? AND tenant_id = ?`,
        )
        .bind(
          payload.status || null,
          payload.emailLink === undefined ? null : payload.emailLink.trim(),
          payload.documentLink === undefined
            ? null
            : payload.documentLink.trim(),
          payload.notes === undefined ? null : payload.notes.trim(),
          payload.dueDate || null,
          payload.status || null,
          now,
          payload.status || null,
          now,
          now,
          id,
          actor.tenantId,
        ),
      db
        .prepare(
          `INSERT INTO request_events
            (tenant_id, request_id, actor_user_id, event_type, detail)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .bind(
          actor.tenantId,
          id,
          actor.userId,
          payload.status ? `status:${payload.status}` : "updated",
          payload.notes ?? null,
        ),
    ]);
    await logActivity(actor, {
      missionId: existing.missionId,
      entityType: "client_request",
      entityId: id,
      action: payload.status ? `status:${payload.status}` : "updated",
      detail: payload.notes ?? null,
    });
    return Response.json({ ok: true, updatedAt: now });
  } catch (error) {
    return apiError(error);
  }
}
