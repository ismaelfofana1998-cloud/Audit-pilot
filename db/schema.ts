import { sql } from "drizzle-orm";
import {
  index,
  integer,
  sqliteTable,
  text,
  uniqueIndex,
} from "drizzle-orm/sqlite-core";

const timestamps = {
  createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  updatedAt: text("updated_at").notNull().default(sql`CURRENT_TIMESTAMP`),
};

export const tenants = sqliteTable(
  "tenants",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    slug: text("slug").notNull(),
    status: text("status").notNull().default("active"),
    timezone: text("timezone").notNull().default("Europe/Paris"),
    ...timestamps,
  },
  (table) => [uniqueIndex("tenants_slug_uq").on(table.slug)],
);

export const users = sqliteTable(
  "users",
  {
    id: text("id").primaryKey(),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    avatarInitials: text("avatar_initials").notNull(),
    ...timestamps,
  },
  (table) => [uniqueIndex("users_email_uq").on(table.email)],
);

export const memberships = sqliteTable(
  "memberships",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    accessRole: text("access_role").notNull().default("member"),
    professionalGrade: text("professional_grade")
      .notNull()
      .default("junior"),
    status: text("status").notNull().default("active"),
    joinedAt: text("joined_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("memberships_tenant_user_uq").on(
      table.tenantId,
      table.userId,
    ),
    index("memberships_tenant_idx").on(table.tenantId),
  ],
);

export const clients = sqliteTable(
  "clients",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    legalForm: text("legal_form"),
    industry: text("industry"),
    primaryContactName: text("primary_contact_name"),
    primaryContactEmail: text("primary_contact_email"),
    ...timestamps,
  },
  (table) => [index("clients_tenant_idx").on(table.tenantId)],
);

export const missions = sqliteTable(
  "missions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    clientId: text("client_id")
      .notNull()
      .references(() => clients.id, { onDelete: "restrict" }),
    title: text("title").notNull(),
    fiscalYear: text("fiscal_year").notNull(),
    missionType: text("mission_type").notNull().default("audit_legal"),
    status: text("status").notNull().default("planning"),
    riskLevel: text("risk_level").notNull().default("normal"),
    closingDate: text("closing_date"),
    interimDate: text("interim_date"),
    finalDate: text("final_date"),
    reportDate: text("report_date"),
    agDate: text("ag_date"),
    ...timestamps,
  },
  (table) => [
    index("missions_tenant_idx").on(table.tenantId),
    index("missions_client_idx").on(table.clientId),
  ],
);

export const missionTeam = sqliteTable(
  "mission_team",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    userId: text("user_id")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    engagementRole: text("engagement_role").notNull(),
    isMissionLead: integer("is_mission_lead", { mode: "boolean" })
      .notNull()
      .default(false),
    canReview: integer("can_review", { mode: "boolean" })
      .notNull()
      .default(false),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("mission_team_mission_user_uq").on(
      table.missionId,
      table.userId,
    ),
    index("mission_team_tenant_idx").on(table.tenantId),
  ],
);

export const auditCycles = sqliteTable(
  "audit_cycles",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    name: text("name").notNull(),
    ownerUserId: text("owner_user_id").references(() => users.id),
    status: text("status").notNull().default("not_started"),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("audit_cycles_mission_code_uq").on(
      table.missionId,
      table.code,
    ),
    index("audit_cycles_tenant_idx").on(table.tenantId),
  ],
);

export const auditProcedures = sqliteTable(
  "audit_procedures",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => auditCycles.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    objective: text("objective").notNull().default(""),
    assertion: text("assertion"),
    ...timestamps,
  },
  (table) => [
    index("audit_procedures_tenant_idx").on(table.tenantId),
    index("audit_procedures_cycle_idx").on(table.cycleId),
  ],
);

export const auditTests = sqliteTable(
  "audit_tests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id")
      .notNull()
      .references(() => auditCycles.id, { onDelete: "cascade" }),
    procedureId: text("procedure_id")
      .notNull()
      .references(() => auditProcedures.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    title: text("title").notNull(),
    instructions: text("instructions").notNull().default(""),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    reviewerUserId: text("reviewer_user_id").references(() => users.id),
    dueDate: text("due_date"),
    preparationStatus: text("preparation_status")
      .notNull()
      .default("not_started"),
    preparedByUserId: text("prepared_by_user_id").references(() => users.id),
    preparedAt: text("prepared_at"),
    conclusion: text("conclusion"),
    evidenceLink: text("evidence_link"),
    reviewStatus: text("review_status").notNull().default("not_started"),
    reviewedByUserId: text("reviewed_by_user_id").references(() => users.id),
    reviewedAt: text("reviewed_at"),
    reviewNote: text("review_note"),
    version: integer("version").notNull().default(1),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("audit_tests_mission_code_uq").on(
      table.missionId,
      table.code,
    ),
    index("audit_tests_tenant_idx").on(table.tenantId),
    index("audit_tests_assignee_idx").on(table.assignedToUserId),
    index("audit_tests_reviewer_idx").on(table.reviewerUserId),
  ],
);

export const clientRequests = sqliteTable(
  "client_requests",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    cycleId: text("cycle_id").references(() => auditCycles.id, {
      onDelete: "set null",
    }),
    title: text("title").notNull(),
    recipientName: text("recipient_name"),
    recipientEmail: text("recipient_email"),
    ownerUserId: text("owner_user_id").references(() => users.id),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("draft"),
    plannedSendDate: text("planned_send_date"),
    dueDate: text("due_date"),
    sentAt: text("sent_at"),
    receivedAt: text("received_at"),
    emailLink: text("email_link"),
    documentLink: text("document_link"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("client_requests_tenant_idx").on(table.tenantId),
    index("client_requests_mission_idx").on(table.missionId),
  ],
);

export const missionNotes = sqliteTable(
  "mission_notes",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    authorUserId: text("author_user_id").references(() => users.id),
    kind: text("kind").notNull().default("note"),
    title: text("title").notNull(),
    content: text("content").notNull().default(""),
    status: text("status").notNull().default("open"),
    dueDate: text("due_date"),
    ...timestamps,
  },
  (table) => [
    index("mission_notes_tenant_idx").on(table.tenantId),
    index("mission_notes_mission_idx").on(table.missionId),
  ],
);

export const activityLog = sqliteTable(
  "activity_log",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id").references(() => missions.id, {
      onDelete: "cascade",
    }),
    actorUserId: text("actor_user_id").references(() => users.id),
    entityType: text("entity_type").notNull(),
    entityId: text("entity_id").notNull(),
    action: text("action").notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("activity_log_tenant_idx").on(table.tenantId),
    index("activity_log_mission_idx").on(table.missionId),
  ],
);

export const invitations = sqliteTable(
  "invitations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    email: text("email").notNull(),
    fullName: text("full_name").notNull(),
    accessRole: text("access_role").notNull().default("member"),
    professionalGrade: text("professional_grade").notNull().default("junior"),
    status: text("status").notNull().default("pending"),
    invitedByUserId: text("invited_by_user_id").references(() => users.id),
    acceptedAt: text("accepted_at"),
    expiresAt: text("expires_at"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    uniqueIndex("invitations_tenant_email_uq").on(
      table.tenantId,
      table.email,
    ),
    index("invitations_email_idx").on(table.email),
  ],
);

export const circularisations = sqliteTable(
  "circularisations",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    type: text("type").notNull(),
    thirdPartyName: text("third_party_name").notNull(),
    contactEmail: text("contact_email"),
    ownerUserId: text("owner_user_id").references(() => users.id),
    status: text("status").notNull().default("draft"),
    sentAt: text("sent_at"),
    responseAt: text("response_at"),
    nextFollowUpAt: text("next_follow_up_at"),
    alternativeProcedure: text("alternative_procedure"),
    evidenceLink: text("evidence_link"),
    notes: text("notes"),
    ...timestamps,
  },
  (table) => [
    index("circularisations_tenant_idx").on(table.tenantId),
    index("circularisations_mission_idx").on(table.missionId),
  ],
);

export const missionTasks = sqliteTable(
  "mission_tasks",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    missionId: text("mission_id")
      .notNull()
      .references(() => missions.id, { onDelete: "cascade" }),
    title: text("title").notNull(),
    kind: text("kind").notNull().default("task"),
    priority: text("priority").notNull().default("normal"),
    status: text("status").notNull().default("todo"),
    assignedToUserId: text("assigned_to_user_id").references(() => users.id),
    dueDate: text("due_date"),
    sourceAnchor: text("source_anchor"),
    offsetDays: integer("offset_days"),
    isDateLocked: integer("is_date_locked", { mode: "boolean" })
      .notNull()
      .default(false),
    completedAt: text("completed_at"),
    ...timestamps,
  },
  (table) => [
    index("mission_tasks_tenant_idx").on(table.tenantId),
    index("mission_tasks_mission_idx").on(table.missionId),
    index("mission_tasks_assignee_idx").on(table.assignedToUserId),
  ],
);

export const requestEvents = sqliteTable(
  "request_events",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    requestId: text("request_id")
      .notNull()
      .references(() => clientRequests.id, { onDelete: "cascade" }),
    actorUserId: text("actor_user_id").references(() => users.id),
    eventType: text("event_type").notNull(),
    detail: text("detail"),
    createdAt: text("created_at").notNull().default(sql`CURRENT_TIMESTAMP`),
  },
  (table) => [
    index("request_events_tenant_idx").on(table.tenantId),
    index("request_events_request_idx").on(table.requestId),
  ],
);

export const testStatusDefinitions = sqliteTable(
  "test_status_definitions",
  {
    id: text("id").primaryKey(),
    tenantId: text("tenant_id")
      .notNull()
      .references(() => tenants.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    code: text("code").notNull(),
    label: text("label").notNull(),
    color: text("color").notNull().default("neutral"),
    sortOrder: integer("sort_order").notNull().default(0),
    isTerminal: integer("is_terminal", { mode: "boolean" })
      .notNull()
      .default(false),
    isActive: integer("is_active", { mode: "boolean" })
      .notNull()
      .default(true),
    ...timestamps,
  },
  (table) => [
    uniqueIndex("test_status_tenant_stage_code_uq").on(
      table.tenantId,
      table.stage,
      table.code,
    ),
    index("test_status_tenant_idx").on(table.tenantId),
  ],
);
