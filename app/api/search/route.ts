import { apiError, getDb, requireApiActor } from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  try {
    const actor = await requireApiActor();
    const q = new URL(request.url).searchParams.get("q")?.trim() ?? "";
    if (q.length < 2) return Response.json({ results: [] });
    const db = await getDb();
    const term = `%${q.replace(/[%_]/g, "")}%`;
    const [missions, tests, requests] = await Promise.all([
      db.prepare(
        `SELECT m.id, m.title, c.name AS subtitle
         FROM missions m JOIN clients c ON c.id = m.client_id
         WHERE m.tenant_id = ? AND (m.title LIKE ? OR c.name LIKE ?)
         ORDER BY m.updated_at DESC LIMIT 5`,
      ).bind(actor.tenantId, term, term).all<{ id: string; title: string; subtitle: string }>(),
      db.prepare(
        `SELECT at.id, at.title, at.code, m.id AS missionId, m.title AS mission
         FROM audit_tests at JOIN missions m ON m.id = at.mission_id
         WHERE at.tenant_id = ? AND (at.title LIKE ? OR at.code LIKE ?)
         ORDER BY at.updated_at DESC LIMIT 5`,
      ).bind(actor.tenantId, term, term).all<{ id: string; title: string; code: string; missionId: string; mission: string }>(),
      db.prepare(
        `SELECT cr.id, cr.title, m.title AS mission
         FROM client_requests cr JOIN missions m ON m.id = cr.mission_id
         WHERE cr.tenant_id = ? AND cr.title LIKE ?
         ORDER BY cr.updated_at DESC LIMIT 4`,
      ).bind(actor.tenantId, term).all<{ id: string; title: string; mission: string }>(),
    ]);
    return Response.json({
      results: [
        ...missions.results.map((item) => ({
          id: `mission:${item.id}`,
          kind: "Mission",
          title: item.title,
          subtitle: item.subtitle,
          href: `/missions/${item.id}`,
        })),
        ...tests.results.map((item) => ({
          id: `test:${item.id}`,
          kind: "Test",
          title: `${item.code} · ${item.title}`,
          subtitle: item.mission,
          href: `/missions/${item.missionId}?test=${item.id}`,
        })),
        ...requests.results.map((item) => ({
          id: `request:${item.id}`,
          kind: "Demande",
          title: item.title,
          subtitle: item.mission,
          href: "/demandes",
        })),
      ].slice(0, 10),
    });
  } catch (error) {
    return apiError(error);
  }
}
