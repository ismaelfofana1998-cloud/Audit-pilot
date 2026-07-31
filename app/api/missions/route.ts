import {
  apiError,
  getDb,
  logActivity,
  makeId,
  requireApiActor,
} from "@/lib/server/core";

export const dynamic = "force-dynamic";

const starterCycles = [
  ["GEN", "Contrôles généraux"],
  ["REV", "Ventes – clients"],
  ["STO", "Stocks"],
  ["IMM", "Immobilisations"],
  ["TRE", "Trésorerie"],
  ["ACH", "Achats – fournisseurs"],
  ["PAY", "Personnel"],
  ["EQU", "Capitaux propres"],
  ["TAX", "Impôts et taxes"],
  ["OTH", "Autres créances et dettes"],
] as const;

function canCreateMission(accessRole: string, grade: string) {
  return (
    ["owner", "admin"].includes(accessRole) ||
    ["partner", "manager", "senior"].includes(grade)
  );
}

function dateOffset(value: string | undefined, days: number) {
  if (!value) return null;
  const date = new Date(`${value}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

export async function POST(request: Request) {
  try {
    const actor = await requireApiActor();
    if (!canCreateMission(actor.accessRole, actor.professionalGrade)) {
      return Response.json(
        { error: "Votre rôle ne permet pas de créer une mission." },
        { status: 403 },
      );
    }
    const payload = (await request.json()) as {
      clientName?: string;
      title?: string;
      fiscalYear?: string;
      missionType?: string;
      riskLevel?: string;
      closingDate?: string;
      interimDate?: string;
      finalDate?: string;
      reportDate?: string;
      agDate?: string;
      leadUserId?: string;
      partnerUserId?: string;
      managerUserId?: string;
      initializeProgram?: boolean;
    };
    const clientName = payload.clientName?.trim() ?? "";
    const title = payload.title?.trim() ?? "";
    const fiscalYear = payload.fiscalYear?.trim() ?? "";
    if (!clientName || !title || !/^\d{4}$/.test(fiscalYear)) {
      return Response.json(
        { error: "Client, intitulé et exercice sur 4 chiffres sont requis." },
        { status: 400 },
      );
    }
    const db = await getDb();
    const clientId = makeId("client");
    const missionId = makeId("mission");
    const statements = [
      db
        .prepare(
          `INSERT INTO clients (id, tenant_id, name)
           VALUES (?, ?, ?)`,
        )
        .bind(clientId, actor.tenantId, clientName),
      db
        .prepare(
          `INSERT INTO missions
            (id, tenant_id, client_id, title, fiscal_year, mission_type,
             status, risk_level, closing_date, interim_date, final_date,
             report_date, ag_date)
           VALUES (?, ?, ?, ?, ?, ?, 'planning', ?, ?, ?, ?, ?, ?)`,
        )
        .bind(
          missionId,
          actor.tenantId,
          clientId,
          title,
          fiscalYear,
          payload.missionType ?? "audit_legal",
          payload.riskLevel ?? "normal",
          payload.closingDate || null,
          payload.interimDate || null,
          payload.finalDate || null,
          payload.reportDate || null,
          payload.agDate || null,
        ),
    ];

    const team = [
      [payload.partnerUserId, "partner", 0, 1],
      [payload.managerUserId, "manager", 0, 1],
      [payload.leadUserId || actor.userId, "senior", 1, 1],
    ] as const;
    for (const [userId, role, isLead, canReview] of team) {
      if (!userId) continue;
      statements.push(
        db
          .prepare(
            `INSERT INTO mission_team
              (id, tenant_id, mission_id, user_id, engagement_role,
               is_mission_lead, can_review)
             SELECT ?, ?, ?, ?, ?, ?, ?
             WHERE EXISTS (
               SELECT 1 FROM memberships
               WHERE tenant_id = ? AND user_id = ? AND status = 'active'
             )
             ON CONFLICT(mission_id, user_id) DO UPDATE SET
               engagement_role = excluded.engagement_role,
               is_mission_lead = excluded.is_mission_lead,
               can_review = excluded.can_review`,
          )
          .bind(
            makeId("team"),
            actor.tenantId,
            missionId,
            userId,
            role,
            isLead,
            canReview,
            actor.tenantId,
            userId,
          ),
      );
    }
    if (payload.initializeProgram !== false) {
      for (const [code, name] of starterCycles) {
        statements.push(
          db
            .prepare(
              `INSERT INTO audit_cycles
                (id, tenant_id, mission_id, code, name, status)
               VALUES (?, ?, ?, ?, ?, 'not_started')`,
            )
            .bind(
              makeId("cycle"),
              actor.tenantId,
              missionId,
              code,
              name,
            ),
        );
      }
    }
    const scheduledTasks = [
      {
        title: "Préparer et envoyer la liste des demandes initiales",
        kind: "request",
        priority: "high",
        anchor: "final",
        offset: -21,
        due: dateOffset(payload.finalDate, -21),
      },
      {
        title: "Lancer les circularisations",
        kind: "circularisation",
        priority: "high",
        anchor: "report",
        offset: -45,
        due: dateOffset(payload.reportDate, -45),
      },
      {
        title: "Clôturer les revues du programme de travail",
        kind: "review",
        priority: "critical",
        anchor: "report",
        offset: -7,
        due: dateOffset(payload.reportDate, -7),
      },
      {
        title: "Finaliser le dossier avant l’assemblée générale",
        kind: "ag",
        priority: "critical",
        anchor: "ag",
        offset: -15,
        due: dateOffset(payload.agDate, -15),
      },
    ].filter((task) => task.due);
    for (const task of scheduledTasks) {
      statements.push(
        db
          .prepare(
            `INSERT INTO mission_tasks
              (id, tenant_id, mission_id, title, kind, priority, status,
               assigned_to_user_id, due_date, source_anchor, offset_days)
             VALUES (?, ?, ?, ?, ?, ?, 'todo', ?, ?, ?, ?)`,
          )
          .bind(
            makeId("task"),
            actor.tenantId,
            missionId,
            task.title,
            task.kind,
            task.priority,
            payload.leadUserId || actor.userId,
            task.due,
            task.anchor,
            task.offset,
          ),
      );
    }
    await db.batch(statements);
    await logActivity(actor, {
      missionId,
      entityType: "mission",
      entityId: missionId,
      action: "created",
      detail: title,
    });
    return Response.json({ missionId }, { status: 201 });
  } catch (error) {
    return apiError(error);
  }
}
