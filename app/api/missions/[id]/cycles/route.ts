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
        { error: "Seul le responsable de mission peut modifier le programme." },
        { status: 403 },
      );
    }
    const payload = (await request.json()) as { code?: string; name?: string };
    const code = payload.code?.trim().toUpperCase() ?? "";
    const name = payload.name?.trim() ?? "";
    if (!code || !name) {
      return Response.json(
        { error: "Code et nom du cycle requis." },
        { status: 400 },
      );
    }
    const db = await getDb();
    const cycleId = makeId("cycle");
    await db
      .prepare(
        `INSERT INTO audit_cycles
          (id, tenant_id, mission_id, code, name, status)
         VALUES (?, ?, ?, ?, ?, 'not_started')`,
      )
      .bind(cycleId, actor.tenantId, missionId, code, name)
      .run();
    await logActivity(actor, {
      missionId,
      entityType: "cycle",
      entityId: cycleId,
      action: "created",
      detail: `${code} — ${name}`,
    });
    return Response.json({ cycleId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
