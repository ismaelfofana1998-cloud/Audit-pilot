import {
  apiError,
  getDb,
  isTenantAdmin,
  logActivity,
  makeId,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

const grades = new Set(["partner", "manager", "senior", "junior", "intern"]);
const roles = new Set(["admin", "member"]);

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor();
    if (!isTenantAdmin(actor)) {
      return Response.json(
        { error: "Seuls les administrateurs peuvent inviter un membre." },
        { status: 403 },
      );
    }
    const payload = (await request.json()) as {
      name?: string;
      email?: string;
      professionalGrade?: string;
      accessRole?: string;
    };
    const name = payload.name?.trim() ?? "";
    const email = payload.email?.trim().toLowerCase() ?? "";
    const professionalGrade = grades.has(payload.professionalGrade ?? "")
      ? payload.professionalGrade!
      : "junior";
    const accessRole = roles.has(payload.accessRole ?? "")
      ? payload.accessRole!
      : "member";
    if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return Response.json(
        { error: "Nom et adresse e-mail valides requis." },
        { status: 400 },
      );
    }
    if (email === actor.email) {
      return Response.json(
        { error: "Vous êtes déjà membre de ce cabinet." },
        { status: 409 },
      );
    }
    const db = await getDb();
    const existing = await db
      .prepare(
        `SELECT 1 FROM memberships m
         JOIN users u ON u.id = m.user_id
         WHERE m.tenant_id = ? AND lower(u.email) = lower(?)
           AND m.status = 'active'`,
      )
      .bind(actor.tenantId, email)
      .first();
    if (existing) {
      return Response.json(
        { error: "Cette personne est déjà membre du cabinet." },
        { status: 409 },
      );
    }
    const invitationId = makeId("invitation");
    await db
      .prepare(
        `INSERT INTO invitations
          (id, tenant_id, email, full_name, access_role, professional_grade,
           status, invited_by_user_id, expires_at)
         VALUES (?, ?, ?, ?, ?, ?, 'pending', ?, datetime('now', '+30 days'))
         ON CONFLICT(tenant_id, email) DO UPDATE SET
           full_name = excluded.full_name,
           access_role = excluded.access_role,
           professional_grade = excluded.professional_grade,
           status = 'pending',
           invited_by_user_id = excluded.invited_by_user_id,
           expires_at = excluded.expires_at`,
      )
      .bind(
        invitationId,
        actor.tenantId,
        email,
        name,
        accessRole,
        professionalGrade,
        actor.userId,
      )
      .run();
    await logActivity(actor, {
      entityType: "invitation",
      entityId: invitationId,
      action: "created",
      detail: email,
    });
    return Response.json(
      {
        invitation: {
          id: invitationId,
          name,
          email,
          grade: professionalGrade,
          access: accessRole,
          status: "pending",
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
