import {
  apiError,
  getMissionPermission,
  getDb,
  logActivity,
  makeId,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor();
    const payload = (await request.json()) as {
      missionId?: string;
      title?: string;
      recipientName?: string;
      recipientEmail?: string;
      ownerUserId?: string;
      priority?: string;
      plannedSendDate?: string;
      dueDate?: string;
      emailLink?: string;
      notes?: string;
    };
    const missionId = payload.missionId?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    if (!missionId || !title) {
      return Response.json(
        { error: "Mission et objet de la demande requis." },
        { status: 400 },
      );
    }
    const db = await getDb();
    const permission = await getMissionPermission(actor, missionId);
    if (!permission) {
      return Response.json({ error: "Mission introuvable." }, { status: 404 });
    }
    if (!permission.isMember) {
      return Response.json({ error: "Vous n’êtes pas affecté à cette mission." }, { status: 403 });
    }
    const id = makeId("request");
    await db
      .prepare(
        `INSERT INTO client_requests
          (id, tenant_id, mission_id, title, recipient_name, recipient_email,
           owner_user_id, priority, status, planned_send_date, due_date,
           email_link, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actor.tenantId,
        missionId,
        title,
        payload.recipientName?.trim() || null,
        payload.recipientEmail?.trim() || null,
        payload.ownerUserId || actor.userId,
        payload.priority ?? "normal",
        payload.plannedSendDate || null,
        payload.dueDate || null,
        payload.emailLink?.trim() || null,
        payload.notes?.trim() || null,
      )
      .run();
    await logActivity(actor, {
      missionId,
      entityType: "client_request",
      entityId: id,
      action: "created",
      detail: title,
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
