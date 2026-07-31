import type { AppActor } from "@/lib/server/core";
import { getDb } from "@/lib/server/core";

export type MemberView = {
  id: string;
  name: string;
  email: string;
  initials: string;
  grade: string;
  access: string;
  status: string;
  missions: number;
};

export type StatusDefinition = {
  id: string;
  stage: "preparation" | "review";
  code: string;
  label: string;
  color: "neutral" | "warning" | "info" | "success" | "danger";
  sortOrder: number;
  isTerminal: number;
};

export type ProgramTest = {
  id: string;
  code: string;
  title: string;
  cycleId: string;
  cycle: string;
  procedureId: string;
  objective: string;
  instructions: string;
  assertion: string;
  assigneeId: string;
  assignee: string;
  assigneeInitials: string;
  reviewerId: string;
  reviewer: string;
  reviewerInitials: string;
  dueDate: string;
  preparationStatus: string;
  reviewStatus: string;
  conclusion: string;
  comments: string;
  evidenceLink: string;
  version: number;
};

export async function getMembers(actor: AppActor): Promise<MemberView[]> {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT u.id, u.full_name AS name, u.email,
              u.avatar_initials AS initials,
              m.professional_grade AS grade,
              m.access_role AS access,
              m.status,
              COUNT(DISTINCT mt.mission_id) AS missions
       FROM memberships m
       JOIN users u ON u.id = m.user_id
       LEFT JOIN mission_team mt
         ON mt.tenant_id = m.tenant_id AND mt.user_id = m.user_id
       WHERE m.tenant_id = ?
       GROUP BY u.id, u.full_name, u.email, u.avatar_initials,
                m.professional_grade, m.access_role, m.status
       ORDER BY
         CASE m.professional_grade
           WHEN 'partner' THEN 0 WHEN 'manager' THEN 1 WHEN 'senior' THEN 2
           WHEN 'junior' THEN 3 ELSE 4
         END, u.full_name`,
    )
    .bind(actor.tenantId)
    .all<MemberView>();
  return result.results;
}

export async function getStatusDefinitions(
  actor: AppActor,
): Promise<StatusDefinition[]> {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT id, stage, code, label, color, sort_order AS sortOrder,
              is_terminal AS isTerminal
       FROM test_status_definitions
       WHERE tenant_id = ? AND is_active = 1
       ORDER BY stage, sort_order, label`,
    )
    .bind(actor.tenantId)
    .all<StatusDefinition>();
  return result.results;
}

export async function getMissions(actor: AppActor) {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT m.id, m.title, m.fiscal_year AS fiscalYear,
              m.mission_type AS missionType, m.status, m.risk_level AS riskLevel,
              m.closing_date AS closingDate, m.interim_date AS interimDate,
              m.final_date AS finalDate, m.report_date AS reportDate,
              m.ag_date AS agDate, c.name AS client,
              COALESCE(lead.full_name, 'Non assigné') AS lead,
              COALESCE(lead.avatar_initials, '—') AS leadInitials,
              COALESCE(partner.full_name, 'Non assigné') AS partner,
              (SELECT COUNT(*) FROM audit_tests at
               WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id) AS tests,
              (SELECT COUNT(*) FROM audit_tests at
               WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id
                 AND at.preparation_status = 'completed') AS completedTests,
              (SELECT COUNT(*) FROM audit_tests at
               WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id
                 AND at.review_status = 'pending') AS pendingReviews,
              (SELECT COUNT(*) FROM client_requests cr
               WHERE cr.mission_id = m.id AND cr.tenant_id = m.tenant_id
                 AND cr.status NOT IN ('received', 'validated', 'closed')) AS openRequests
       FROM missions m
       JOIN clients c ON c.id = m.client_id AND c.tenant_id = m.tenant_id
       LEFT JOIN mission_team lead_team
         ON lead_team.mission_id = m.id AND lead_team.tenant_id = m.tenant_id
        AND lead_team.is_mission_lead = 1
       LEFT JOIN users lead ON lead.id = lead_team.user_id
       LEFT JOIN mission_team partner_team
         ON partner_team.mission_id = m.id AND partner_team.tenant_id = m.tenant_id
        AND partner_team.engagement_role = 'partner'
       LEFT JOIN users partner ON partner.id = partner_team.user_id
       WHERE m.tenant_id = ?
       GROUP BY m.id, c.name, lead.full_name, lead.avatar_initials, partner.full_name
       ORDER BY COALESCE(m.report_date, m.ag_date, '9999-12-31'), c.name`,
    )
    .bind(actor.tenantId)
    .all<{
      id: string;
      title: string;
      fiscalYear: string;
      missionType: string;
      status: string;
      riskLevel: string;
      closingDate: string | null;
      interimDate: string | null;
      finalDate: string | null;
      reportDate: string | null;
      agDate: string | null;
      client: string;
      lead: string;
      leadInitials: string;
      partner: string;
      tests: number;
      completedTests: number;
      pendingReviews: number;
      openRequests: number;
    }>();
  return result.results;
}

export async function getMissionProgram(actor: AppActor, missionId: string) {
  const db = await getDb();
  const mission = await db
    .prepare(
      `SELECT m.id, m.title, m.fiscal_year AS fiscalYear,
              m.mission_type AS missionType, m.status, m.risk_level AS riskLevel,
              m.closing_date AS closingDate, m.interim_date AS interimDate,
              m.final_date AS finalDate, m.report_date AS reportDate,
              m.ag_date AS agDate, c.name AS client
       FROM missions m
       JOIN clients c ON c.id = m.client_id AND c.tenant_id = m.tenant_id
       WHERE m.id = ? AND m.tenant_id = ?`,
    )
    .bind(missionId, actor.tenantId)
    .first<{
      id: string;
      title: string;
      fiscalYear: string;
      missionType: string;
      status: string;
      riskLevel: string;
      closingDate: string | null;
      interimDate: string | null;
      finalDate: string | null;
      reportDate: string | null;
      agDate: string | null;
      client: string;
    }>();
  if (!mission) return null;

  const [cyclesResult, testsResult, teamResult] = await Promise.all([
    db
      .prepare(
        `SELECT id, code, name, status
         FROM audit_cycles
         WHERE mission_id = ? AND tenant_id = ?
         ORDER BY created_at, name`,
      )
      .bind(missionId, actor.tenantId)
      .all<{ id: string; code: string; name: string; status: string }>(),
    db
      .prepare(
        `SELECT at.id, at.code, at.title, at.cycle_id AS cycleId,
                ac.name AS cycle, at.procedure_id AS procedureId,
                ap.objective, at.instructions, COALESCE(ap.assertion, '') AS assertion,
                COALESCE(at.assigned_to_user_id, '') AS assigneeId,
                COALESCE(assignee.full_name, 'Non assigné') AS assignee,
                COALESCE(assignee.avatar_initials, '—') AS assigneeInitials,
                COALESCE(at.reviewer_user_id, '') AS reviewerId,
                COALESCE(reviewer.full_name, 'Non assigné') AS reviewer,
                COALESCE(reviewer.avatar_initials, '—') AS reviewerInitials,
                COALESCE(at.due_date, '') AS dueDate,
                at.preparation_status AS preparationStatus,
                at.review_status AS reviewStatus,
                COALESCE(at.conclusion, '') AS conclusion,
                COALESCE(at.review_note, '') AS comments,
                COALESCE(at.evidence_link, '') AS evidenceLink,
                at.version
         FROM audit_tests at
         JOIN audit_cycles ac ON ac.id = at.cycle_id AND ac.tenant_id = at.tenant_id
         JOIN audit_procedures ap ON ap.id = at.procedure_id AND ap.tenant_id = at.tenant_id
         LEFT JOIN users assignee ON assignee.id = at.assigned_to_user_id
         LEFT JOIN users reviewer ON reviewer.id = at.reviewer_user_id
         WHERE at.mission_id = ? AND at.tenant_id = ?
         ORDER BY ac.created_at, at.code, at.created_at`,
      )
      .bind(missionId, actor.tenantId)
      .all<ProgramTest>(),
    db
      .prepare(
        `SELECT mt.user_id AS id, u.full_name AS name,
                u.avatar_initials AS initials, mt.engagement_role AS role,
                mt.is_mission_lead AS isLead, mt.can_review AS canReview
         FROM mission_team mt
         JOIN users u ON u.id = mt.user_id
         WHERE mt.mission_id = ? AND mt.tenant_id = ?
         ORDER BY CASE mt.engagement_role
           WHEN 'partner' THEN 0 WHEN 'manager' THEN 1 WHEN 'senior' THEN 2
           WHEN 'junior' THEN 3 ELSE 4 END`,
      )
      .bind(missionId, actor.tenantId)
      .all<{
        id: string;
        name: string;
        initials: string;
        role: string;
        isLead: number;
        canReview: number;
      }>(),
  ]);

  const [tasksResult, requestsResult, circularisationsResult, activityResult] =
    await Promise.all([
      db.prepare(
        `SELECT mt.id, mt.title, mt.kind, mt.priority, mt.status,
                mt.due_date AS dueDate, COALESCE(u.full_name, 'Non assigné') AS assignee
         FROM mission_tasks mt
         LEFT JOIN users u ON u.id = mt.assigned_to_user_id
         WHERE mt.mission_id = ? AND mt.tenant_id = ?
           AND mt.status != 'completed'
         ORDER BY COALESCE(mt.due_date, '9999-12-31') LIMIT 8`,
      ).bind(missionId, actor.tenantId).all<{
        id: string; title: string; kind: string; priority: string; status: string;
        dueDate: string | null; assignee: string;
      }>(),
      db.prepare(
        `SELECT id, title, status, due_date AS dueDate
         FROM client_requests
         WHERE mission_id = ? AND tenant_id = ?
           AND status NOT IN ('received', 'validated', 'closed')
         ORDER BY COALESCE(due_date, '9999-12-31') LIMIT 6`,
      ).bind(missionId, actor.tenantId).all<{
        id: string; title: string; status: string; dueDate: string | null;
      }>(),
      db.prepare(
        `SELECT id, third_party_name AS thirdParty, type, status,
                next_follow_up_at AS nextFollowUpAt
         FROM circularisations
         WHERE mission_id = ? AND tenant_id = ? AND status != 'closed'
         ORDER BY COALESCE(next_follow_up_at, '9999-12-31') LIMIT 6`,
      ).bind(missionId, actor.tenantId).all<{
        id: string; thirdParty: string; type: string; status: string; nextFollowUpAt: string | null;
      }>(),
      db.prepare(
        `SELECT al.id, al.action, al.entity_type AS entityType,
                COALESCE(al.detail, '') AS detail, al.created_at AS createdAt,
                COALESCE(u.full_name, 'Système') AS actor
         FROM activity_log al LEFT JOIN users u ON u.id = al.actor_user_id
         WHERE al.mission_id = ? AND al.tenant_id = ?
         ORDER BY al.created_at DESC LIMIT 10`,
      ).bind(missionId, actor.tenantId).all<{
        id: number; action: string; entityType: string; detail: string; createdAt: string; actor: string;
      }>(),
    ]);

  return {
    mission,
    cycles: cyclesResult.results,
    tests: testsResult.results,
    team: teamResult.results,
    tasks: tasksResult.results,
    requests: requestsResult.results,
    circularisations: circularisationsResult.results,
    activity: activityResult.results,
  };
}

export async function getRequests(actor: AppActor) {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT cr.id, cr.mission_id AS missionId, m.title AS mission,
              cr.title, COALESCE(cr.recipient_name, 'Non renseigné') AS contact,
              COALESCE(cr.recipient_email, '') AS contactEmail,
              COALESCE(cr.owner_user_id, '') AS ownerId,
              COALESCE(u.full_name, 'Non assigné') AS owner,
              COALESCE(u.avatar_initials, '—') AS initials,
              cr.priority, cr.status,
              COALESCE(cr.planned_send_date, '') AS plannedSendDate,
              COALESCE(cr.due_date, '') AS dueDate,
              COALESCE(cr.sent_at, '') AS sentAt,
              COALESCE(cr.received_at, '') AS receivedAt,
              COALESCE(cr.email_link, '') AS emailLink,
              COALESCE(cr.document_link, '') AS documentLink,
              COALESCE(cr.notes, '') AS notes
       FROM client_requests cr
       JOIN missions m ON m.id = cr.mission_id AND m.tenant_id = cr.tenant_id
       LEFT JOIN users u ON u.id = cr.owner_user_id
       WHERE cr.tenant_id = ?
       ORDER BY CASE WHEN cr.status IN ('received', 'validated', 'closed') THEN 1 ELSE 0 END,
                COALESCE(cr.due_date, '9999-12-31'), cr.created_at DESC`,
    )
    .bind(actor.tenantId)
    .all();
  return result.results;
}

export async function getTenantSummary(actor: AppActor) {
  const db = await getDb();
  const [tenant, invitations, counts] = await Promise.all([
    db
      .prepare(
        "SELECT id, name, slug, timezone, status FROM tenants WHERE id = ?",
      )
      .bind(actor.tenantId)
      .first<{
        id: string;
        name: string;
        slug: string;
        timezone: string;
        status: string;
      }>(),
    db
      .prepare(
        `SELECT id, full_name AS name, email,
                professional_grade AS grade, access_role AS access,
                status, created_at AS createdAt
         FROM invitations
         WHERE tenant_id = ? AND status = 'pending'
         ORDER BY created_at DESC`,
      )
      .bind(actor.tenantId)
      .all<{
        id: string;
        name: string;
        email: string;
        grade: string;
        access: string;
        status: string;
        createdAt: string;
      }>(),
    db
      .prepare(
        `SELECT
           (SELECT COUNT(*) FROM memberships WHERE tenant_id = ? AND status = 'active') AS members,
           (SELECT COUNT(*) FROM missions WHERE tenant_id = ? AND status NOT IN ('closed', 'archived')) AS missions,
           (SELECT COUNT(*) FROM memberships WHERE tenant_id = ? AND access_role IN ('owner', 'admin') AND status = 'active') AS admins`,
      )
      .bind(actor.tenantId, actor.tenantId, actor.tenantId)
      .first<{ members: number; missions: number; admins: number }>(),
  ]);
  return { tenant, invitations: invitations.results, counts };
}

export async function getDashboard(actor: AppActor) {
  const db = await getDb();
  const [metrics, myTests, deadlines, requests, tasks, portfolio] = await Promise.all([
    db
      .prepare(
        `SELECT
          (SELECT COUNT(*) FROM missions WHERE tenant_id = ? AND status NOT IN ('closed', 'archived')) AS missions,
          (SELECT COUNT(*) FROM missions WHERE tenant_id = ?
             AND COALESCE(report_date, ag_date) BETWEEN date('now') AND date('now', '+30 days')) AS deadlines,
          (SELECT COUNT(*) FROM client_requests WHERE tenant_id = ?
             AND status NOT IN ('received', 'validated', 'closed')) AS requests,
          (SELECT COUNT(*) FROM audit_tests WHERE tenant_id = ?
             AND reviewer_user_id = ? AND review_status = 'pending') AS reviews`,
      )
      .bind(
        actor.tenantId,
        actor.tenantId,
        actor.tenantId,
        actor.tenantId,
        actor.userId,
      )
      .first<{
        missions: number;
        deadlines: number;
        requests: number;
        reviews: number;
      }>(),
    db
      .prepare(
        `SELECT at.id, at.code, at.title, m.id AS missionId, m.title AS mission,
                ac.name AS cycle, at.due_date AS dueDate,
                at.preparation_status AS preparationStatus,
                at.review_status AS reviewStatus,
                CASE WHEN at.assigned_to_user_id = ? THEN 'prepare' ELSE 'review' END AS responsibility
         FROM audit_tests at
         JOIN missions m ON m.id = at.mission_id AND m.tenant_id = at.tenant_id
         JOIN audit_cycles ac ON ac.id = at.cycle_id AND ac.tenant_id = at.tenant_id
         WHERE at.tenant_id = ?
           AND (at.assigned_to_user_id = ? OR at.reviewer_user_id = ?)
           AND NOT (at.preparation_status = 'completed' AND at.review_status = 'approved')
         ORDER BY COALESCE(at.due_date, '9999-12-31'), m.title, at.code
         LIMIT 12`,
      )
      .bind(actor.userId, actor.tenantId, actor.userId, actor.userId)
      .all<{
        id: string;
        code: string;
        title: string;
        missionId: string;
        mission: string;
        cycle: string;
        dueDate: string | null;
        preparationStatus: string;
        reviewStatus: string;
        responsibility: "prepare" | "review";
      }>(),
    db
      .prepare(
        `SELECT id, title, report_date AS reportDate, ag_date AS agDate
         FROM missions
         WHERE tenant_id = ? AND status NOT IN ('closed', 'archived')
         ORDER BY COALESCE(report_date, ag_date, '9999-12-31')
         LIMIT 5`,
      )
      .bind(actor.tenantId)
      .all<{
        id: string;
        title: string;
        reportDate: string | null;
        agDate: string | null;
      }>(),
    db
      .prepare(
        `SELECT cr.id, cr.title, cr.status, cr.due_date AS dueDate,
                m.title AS mission
         FROM client_requests cr
         JOIN missions m ON m.id = cr.mission_id AND m.tenant_id = cr.tenant_id
         WHERE cr.tenant_id = ?
           AND cr.status NOT IN ('received', 'validated', 'closed')
         ORDER BY COALESCE(cr.due_date, '9999-12-31')
         LIMIT 6`,
      )
      .bind(actor.tenantId)
      .all<{
        id: string;
        title: string;
        status: string;
        dueDate: string | null;
        mission: string;
      }>(),
    db
      .prepare(
        `SELECT mt.id, mt.title, mt.kind, mt.priority, mt.due_date AS dueDate,
                m.id AS missionId, m.title AS mission
         FROM mission_tasks mt
         JOIN missions m ON m.id = mt.mission_id AND m.tenant_id = mt.tenant_id
         WHERE mt.tenant_id = ? AND mt.status = 'todo'
           AND (mt.assigned_to_user_id = ? OR mt.assigned_to_user_id IS NULL)
         ORDER BY COALESCE(mt.due_date, '9999-12-31')
         LIMIT 8`,
      )
      .bind(actor.tenantId, actor.userId)
      .all<{
        id: string;
        title: string;
        kind: string;
        priority: string;
        dueDate: string | null;
        missionId: string;
        mission: string;
      }>(),
    db
      .prepare(
        `SELECT m.id, m.title, c.name AS client, m.status,
                m.report_date AS reportDate, m.ag_date AS agDate,
                CAST(julianday(COALESCE(m.report_date, m.ag_date)) - julianday('now') AS INTEGER) AS daysLeft,
                (SELECT COUNT(*) FROM audit_tests at WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id) AS tests,
                (SELECT COUNT(*) FROM audit_tests at WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id
                  AND at.preparation_status = 'completed' AND at.review_status = 'approved') AS approvedTests,
                (SELECT COUNT(*) FROM audit_tests at WHERE at.mission_id = m.id AND at.tenant_id = m.tenant_id
                  AND at.review_status = 'pending') AS pendingReviews,
                (SELECT COUNT(*) FROM client_requests cr WHERE cr.mission_id = m.id AND cr.tenant_id = m.tenant_id
                  AND cr.status NOT IN ('received', 'validated', 'closed')
                  AND cr.due_date < date('now')) AS overdueRequests
         FROM missions m
         JOIN clients c ON c.id = m.client_id AND c.tenant_id = m.tenant_id
         WHERE m.tenant_id = ? AND m.status NOT IN ('closed', 'archived')
         ORDER BY COALESCE(m.report_date, m.ag_date, '9999-12-31')
         LIMIT 8`,
      )
      .bind(actor.tenantId)
      .all<{
        id: string;
        title: string;
        client: string;
        status: string;
        reportDate: string | null;
        agDate: string | null;
        daysLeft: number | null;
        tests: number;
        approvedTests: number;
        pendingReviews: number;
        overdueRequests: number;
      }>(),
  ]);
  return {
    metrics: metrics ?? { missions: 0, deadlines: 0, requests: 0, reviews: 0 },
    myTests: myTests.results,
    deadlines: deadlines.results,
    requests: requests.results,
    tasks: tasks.results,
    portfolio: portfolio.results.map((mission) => {
      const progress = mission.tests
        ? Math.round((mission.approvedTests / mission.tests) * 100)
        : 0;
      const health: "danger" | "warning" | "success" =
        (mission.daysLeft !== null && mission.daysLeft < 0) || mission.overdueRequests > 2
          ? "danger"
          : (mission.daysLeft !== null && mission.daysLeft <= 21 && progress < 70) || mission.pendingReviews > 3
            ? "warning"
            : "success";
      return { ...mission, progress, health };
    }),
  };
}

export async function getPlanning(actor: AppActor) {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT at.id, at.code, at.title, m.id AS missionId, m.title AS mission,
              ac.name AS cycle, at.due_date AS dueDate,
              at.preparation_status AS preparationStatus,
              at.review_status AS reviewStatus,
              assignee.id AS assigneeId,
              assignee.full_name AS assignee,
              assignee.avatar_initials AS assigneeInitials,
              reviewer.id AS reviewerId,
              reviewer.full_name AS reviewer,
              reviewer.avatar_initials AS reviewerInitials
       FROM audit_tests at
       JOIN missions m ON m.id = at.mission_id AND m.tenant_id = at.tenant_id
       JOIN audit_cycles ac ON ac.id = at.cycle_id AND ac.tenant_id = at.tenant_id
       LEFT JOIN users assignee ON assignee.id = at.assigned_to_user_id
       LEFT JOIN users reviewer ON reviewer.id = at.reviewer_user_id
       WHERE at.tenant_id = ?
         AND NOT (at.preparation_status = 'completed' AND at.review_status = 'approved')
       ORDER BY COALESCE(at.due_date, '9999-12-31'), m.title, at.code`,
    )
    .bind(actor.tenantId)
    .all<{
      id: string;
      code: string;
      title: string;
      missionId: string;
      mission: string;
      cycle: string;
      dueDate: string | null;
      preparationStatus: string;
      reviewStatus: string;
      assigneeId: string | null;
      assignee: string | null;
      assigneeInitials: string | null;
      reviewerId: string | null;
      reviewer: string | null;
      reviewerInitials: string | null;
    }>();
  return result.results;
}

export async function getCircularisations(actor: AppActor) {
  const db = await getDb();
  const result = await db
    .prepare(
      `SELECT c.id, c.mission_id AS missionId, m.title AS mission,
              c.type, c.third_party_name AS thirdParty,
              COALESCE(c.contact_email, '') AS contactEmail,
              COALESCE(c.owner_user_id, '') AS ownerId,
              COALESCE(u.full_name, 'Non assigné') AS owner,
              COALESCE(u.avatar_initials, '—') AS initials,
              c.status, COALESCE(c.sent_at, '') AS sentAt,
              COALESCE(c.response_at, '') AS responseAt,
              COALESCE(c.next_follow_up_at, '') AS nextFollowUpAt,
              COALESCE(c.alternative_procedure, '') AS alternativeProcedure,
              COALESCE(c.evidence_link, '') AS evidenceLink,
              COALESCE(c.notes, '') AS notes
       FROM circularisations c
       JOIN missions m ON m.id = c.mission_id AND m.tenant_id = c.tenant_id
       LEFT JOIN users u ON u.id = c.owner_user_id
       WHERE c.tenant_id = ?
       ORDER BY CASE WHEN c.status = 'response_received' THEN 1 ELSE 0 END,
                COALESCE(c.next_follow_up_at, '9999-12-31')`,
    )
    .bind(actor.tenantId)
    .all();
  return result.results;
}
