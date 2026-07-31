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
      type?: string;
      thirdParty?: string;
      contactEmail?: string;
      ownerUserId?: string;
      nextFollowUpAt?: string;
      notes?: string;
    };
    const missionId = payload.missionId?.trim() ?? "";
    const thirdParty = payload.thirdParty?.trim() ?? "";
    if (!missionId || !thirdParty) {
      return Response.json(
        { error: "Mission et tiers à circulariser requis." },
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
    const id = makeId("circularisation");
    await db
      .prepare(
        `INSERT INTO circularisations
          (id, tenant_id, mission_id, type, third_party_name, contact_email,
           owner_user_id, status, next_follow_up_at, notes)
         VALUES (?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?)`,
      )
      .bind(
        id,
        actor.tenantId,
        missionId,
        payload.type ?? "bank",
        thirdParty,
        payload.contactEmail?.trim() || null,
        payload.ownerUserId || actor.userId,
        payload.nextFollowUpAt || null,
        payload.notes?.trim() || null,
      )
      .run();
    await logActivity(actor, {
      missionId,
      entityType: "circularisation",
      entityId: id,
      action: "created",
      detail: thirdParty,
    });
    return Response.json({ id }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
