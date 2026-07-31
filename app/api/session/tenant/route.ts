import { cookies } from "next/headers";
import { apiError, getDb, requireApiActor } from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor();
    const payload = (await request.json()) as { tenantId?: string };
    const tenantId = payload.tenantId?.trim() ?? "";
    const db = await getDb();
    const allowed = await db
      .prepare(
        `SELECT 1
         FROM memberships
         WHERE tenant_id = ? AND user_id = ? AND status = 'active'`,
      )
      .bind(tenantId, actor.userId)
      .first();
    if (!allowed) {
      return Response.json({ error: "Accès au cabinet refusé." }, { status: 403 });
    }
    const cookieStore = await cookies();
    cookieStore.set("auditpilot_tenant", tenantId, {
      httpOnly: true,
      sameSite: "lax",
      secure: true,
      path: "/",
      maxAge: 60 * 60 * 24 * 365,
    });
    return Response.json({ ok: true });
  } catch (error) {
    return apiError(error);
  }
}
