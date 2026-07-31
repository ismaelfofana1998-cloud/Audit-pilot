import {
  apiError,
  getDb,
  isTenantAdmin,
  logActivity,
  makeId,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor();
    if (!isTenantAdmin(actor)) {
      return Response.json(
        { error: "Seuls les administrateurs peuvent paramétrer les statuts." },
        { status: 403 },
      );
    }
    const payload = (await request.json()) as {
      stage?: string;
      code?: string;
      label?: string;
      color?: string;
      isTerminal?: boolean;
    };
    const stage = payload.stage === "review" ? "review" : "preparation";
    const code =
      payload.code
        ?.trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "_")
        .replace(/^_|_$/g, "") ?? "";
    const label = payload.label?.trim() ?? "";
    const colors = new Set(["neutral", "warning", "info", "success", "danger"]);
    const color = colors.has(payload.color ?? "") ? payload.color! : "neutral";
    if (!code || !label) {
      return Response.json(
        { error: "Code et libellé du statut requis." },
        { status: 400 },
      );
    }
    const db = await getDb();
    const nextOrder = await db
      .prepare(
        `SELECT COALESCE(MAX(sort_order), 0) + 10 AS value
         FROM test_status_definitions
         WHERE tenant_id = ? AND stage = ?`,
      )
      .bind(actor.tenantId, stage)
      .first<{ value: number }>();
    const id = makeId("status");
    await db
      .prepare(
        `INSERT INTO test_status_definitions
          (id, tenant_id, stage, code, label, color, sort_order, is_terminal)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .bind(
        id,
        actor.tenantId,
        stage,
        code,
        label,
        color,
        nextOrder?.value ?? 10,
        payload.isTerminal ? 1 : 0,
      )
      .run();
    await logActivity(actor, {
      entityType: "test_status",
      entityId: id,
      action: "created",
      detail: `${stage}:${label}`,
    });
    return Response.json(
      {
        status: {
          id,
          stage,
          code,
          label,
          color,
          sortOrder: nextOrder?.value ?? 10,
          isTerminal: payload.isTerminal ? 1 : 0,
        },
      },
      { status: 201 },
    );
  } catch (error) {
    return apiError(error);
  }
}
