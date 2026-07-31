import { cookies, headers } from "next/headers";
import { getChatGPTUser, requireChatGPTUser } from "@/app/chatgpt-auth";

export type AppActor = {
  userId: string;
  email: string;
  fullName: string;
  initials: string;
  tenantId: string;
  tenantName: string;
  accessRole: string;
  professionalGrade: string;
  tenants: Array<{ id: string; name: string; slug: string }>;
};

function safeId(prefix: string, value: string) {
  return `${prefix}-${value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}

export function makeId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function getInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

async function identity(required: boolean, returnTo = "/") {
  const user = await getChatGPTUser();
  if (user) {
    return {
      email: user.email.toLowerCase(),
      fullName: user.fullName ?? user.displayName,
    };
  }

  const requestHeaders = await headers();
  const host = requestHeaders.get("host") ?? "";
  if (host.startsWith("terminal.local")) {
    return {
      email: "ismael@auditpilot.local",
      fullName: "Ismaël Fofana",
    };
  }

  if (required) {
    const authenticated = await requireChatGPTUser(returnTo);
    return {
      email: authenticated.email.toLowerCase(),
      fullName: authenticated.fullName ?? authenticated.displayName,
    };
  }
  throw new Error("AUTH_REQUIRED");
}

export async function getDb() {
  const { env } = await import("cloudflare:workers");
  return env.DB;
}

async function ensureIdentityUser(
  db: D1Database,
  user: { email: string; fullName: string },
) {
  const existing = await db
    .prepare("SELECT id FROM users WHERE lower(email) = lower(?)")
    .bind(user.email)
    .first<{ id: string }>();
  const userId = existing?.id ?? safeId("user", user.email);
  await db
    .prepare(
      `INSERT INTO users (id, email, full_name, avatar_initials)
       VALUES (?, ?, ?, ?)
       ON CONFLICT(email) DO UPDATE SET full_name = excluded.full_name,
         avatar_initials = excluded.avatar_initials, updated_at = CURRENT_TIMESTAMP`,
    )
    .bind(userId, user.email, user.fullName, getInitials(user.fullName))
    .run();

  const pending = await db
    .prepare(
      `SELECT id, tenant_id AS tenantId, access_role AS accessRole,
              professional_grade AS professionalGrade
       FROM invitations
       WHERE lower(email) = lower(?) AND status = 'pending'
         AND (expires_at IS NULL OR expires_at >= CURRENT_TIMESTAMP)`,
    )
    .bind(user.email)
    .all<{
      id: string;
      tenantId: string;
      accessRole: string;
      professionalGrade: string;
    }>();

  for (const invitation of pending.results) {
    await db.batch([
      db
        .prepare(
          `INSERT INTO memberships
            (id, tenant_id, user_id, access_role, professional_grade, status)
           VALUES (?, ?, ?, ?, ?, 'active')
           ON CONFLICT(tenant_id, user_id) DO UPDATE SET
             access_role = excluded.access_role,
             professional_grade = excluded.professional_grade,
             status = 'active'`,
        )
        .bind(
          makeId("membership"),
          invitation.tenantId,
          userId,
          invitation.accessRole,
          invitation.professionalGrade,
        ),
      db
        .prepare(
          "UPDATE invitations SET status = 'accepted', accepted_at = CURRENT_TIMESTAMP WHERE id = ?",
        )
        .bind(invitation.id),
    ]);
  }
  return userId;
}

async function bootstrapTenant(
  db: D1Database,
  userId: string,
  user: { email: string; fullName: string },
) {
  const legacy = await db
    .prepare("SELECT id FROM tenants WHERE id = 'tenant-ferco'")
    .first<{ id: string }>();
  const tenantId = legacy?.id ?? makeId("tenant");
  const tenantName = legacy ? "Cabinet FERCO" : `Cabinet ${user.fullName}`;
  if (!legacy) {
    await db
      .prepare(
        "INSERT INTO tenants (id, name, slug, status) VALUES (?, ?, ?, 'active')",
      )
      .bind(tenantId, tenantName, safeId("cabinet", user.fullName))
      .run();
  }
  await db
    .prepare(
      `INSERT INTO memberships
        (id, tenant_id, user_id, access_role, professional_grade, status)
       VALUES (?, ?, ?, 'owner', 'senior', 'active')
       ON CONFLICT(tenant_id, user_id) DO UPDATE SET status = 'active'`,
    )
    .bind(makeId("membership"), tenantId, userId)
    .run();
}

async function ensureTenantDefaults(db: D1Database, tenantId: string) {
  const statuses = [
    ["preparation", "not_started", "À faire", "neutral", 10, 0],
    ["preparation", "in_progress", "En cours", "warning", 20, 0],
    ["preparation", "submitted", "Soumis à la revue", "info", 30, 0],
    ["preparation", "completed", "Réalisé", "success", 40, 1],
    ["review", "not_started", "Non démarrée", "neutral", 10, 0],
    ["review", "pending", "À revoir", "warning", 20, 0],
    ["review", "changes_requested", "Corrections demandées", "danger", 30, 0],
    ["review", "approved", "Revue validée", "success", 40, 1],
  ] as const;
  await db.batch(
    statuses.map(([stage, code, label, color, sortOrder, isTerminal]) =>
      db
        .prepare(
          `INSERT INTO test_status_definitions
            (id, tenant_id, stage, code, label, color, sort_order, is_terminal)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)
           ON CONFLICT(tenant_id, stage, code) DO NOTHING`,
        )
        .bind(
          `status-${tenantId}-${stage}-${code}`,
          tenantId,
          stage,
          code,
          label,
          color,
          sortOrder,
          isTerminal,
        ),
    ),
  );
}

async function resolveActor(
  user: { email: string; fullName: string },
  createTenant: boolean,
) {
  const db = await getDb();
  const userId = await ensureIdentityUser(db, user);
  let memberships = await db
    .prepare(
      `SELECT m.tenant_id AS id, t.name, t.slug,
              m.access_role AS accessRole,
              m.professional_grade AS professionalGrade
       FROM memberships m
       JOIN tenants t ON t.id = m.tenant_id
       WHERE m.user_id = ? AND m.status = 'active' AND t.status = 'active'
       ORDER BY CASE m.access_role WHEN 'owner' THEN 0 WHEN 'admin' THEN 1 ELSE 2 END,
                t.name`,
    )
    .bind(userId)
    .all<{
      id: string;
      name: string;
      slug: string;
      accessRole: string;
      professionalGrade: string;
    }>();

  if (!memberships.results.length && createTenant) {
    await bootstrapTenant(db, userId, user);
    memberships = await db
      .prepare(
        `SELECT m.tenant_id AS id, t.name, t.slug,
                m.access_role AS accessRole,
                m.professional_grade AS professionalGrade
         FROM memberships m JOIN tenants t ON t.id = m.tenant_id
         WHERE m.user_id = ? AND m.status = 'active'`,
      )
      .bind(userId)
      .all();
  }

  if (!memberships.results.length) throw new Error("TENANT_ACCESS_DENIED");
  const cookieStore = await cookies();
  const requestedTenant = cookieStore.get("auditpilot_tenant")?.value;
  const active =
    memberships.results.find((membership) => membership.id === requestedTenant) ??
    memberships.results[0];
  await ensureTenantDefaults(db, active.id);

  return {
    userId,
    email: user.email,
    fullName: user.fullName,
    initials: getInitials(user.fullName),
    tenantId: active.id,
    tenantName: active.name,
    accessRole: active.accessRole,
    professionalGrade: active.professionalGrade,
    tenants: memberships.results.map((membership) => ({
      id: membership.id,
      name: membership.name,
      slug: membership.slug,
    })),
  } satisfies AppActor;
}

export async function requirePageActor(returnTo = "/") {
  const user = await identity(true, returnTo);
  return resolveActor(user, true);
}

export async function requireApiActor() {
  const user = await identity(false);
  return resolveActor(user, false);
}

export function isTenantAdmin(actor: AppActor) {
  return actor.accessRole === "owner" || actor.accessRole === "admin";
}

export async function getMissionPermission(
  actor: AppActor,
  missionId: string,
) {
  const db = await getDb();
  const mission = await db
    .prepare(
      `SELECT m.id,
              CASE WHEN mt.user_id IS NOT NULL THEN 1 ELSE 0 END AS isMember,
              COALESCE(mt.is_mission_lead, 0) AS isLead,
              COALESCE(mt.can_review, 0) AS canReview,
              COALESCE(mt.engagement_role, '') AS missionRole
       FROM missions m
       LEFT JOIN mission_team mt
         ON mt.mission_id = m.id AND mt.tenant_id = m.tenant_id
        AND mt.user_id = ?
       WHERE m.id = ? AND m.tenant_id = ?`,
    )
    .bind(actor.userId, missionId, actor.tenantId)
    .first<{
      id: string;
      isMember: number;
      isLead: number;
      canReview: number;
      missionRole: string;
    }>();
  if (!mission) return null;
  const tenantAdmin = isTenantAdmin(actor);
  return {
    isMember: tenantAdmin || Boolean(mission.isMember),
    canManage:
      tenantAdmin ||
      Boolean(mission.isLead) ||
      ["partner", "manager"].includes(mission.missionRole),
    canReview: tenantAdmin || Boolean(mission.canReview),
  };
}

export async function logActivity(
  actor: AppActor,
  values: {
    missionId?: string | null;
    entityType: string;
    entityId: string;
    action: string;
    detail?: string | null;
  },
) {
  const db = await getDb();
  await db
    .prepare(
      `INSERT INTO activity_log
        (tenant_id, mission_id, actor_user_id, entity_type, entity_id, action, detail)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .bind(
      actor.tenantId,
      values.missionId ?? null,
      actor.userId,
      values.entityType,
      values.entityId,
      values.action,
      values.detail ?? null,
    )
    .run();
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : "UNEXPECTED_ERROR";
  if (message === "AUTH_REQUIRED") {
    return Response.json({ error: "Authentification requise." }, { status: 401 });
  }
  if (message === "TENANT_ACCESS_DENIED") {
    return Response.json({ error: "Accès au cabinet refusé." }, { status: 403 });
  }
  if (message.includes("no such table")) {
    return Response.json(
      { error: "La base est en cours de mise à jour." },
      { status: 503 },
    );
  }
  return Response.json(
    { error: message === "UNEXPECTED_ERROR" ? "Erreur inattendue." : message },
    { status: 500 },
  );
}
