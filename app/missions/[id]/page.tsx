import Link from "next/link";
import { notFound } from "next/navigation";
import { AppShell } from "@/components/app-shell";
import { TestWorkbench } from "@/components/test-workbench";
import { Person, StatusPill } from "@/components/ui";
import { requirePageActor } from "@/lib/server/core";
import {
  getMembers,
  getMissionProgram,
  getStatusDefinitions,
} from "@/lib/server/queries";

function formatDate(value: string | null) {
  if (!value) return "Non définie";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function daysUntil(value: string | null) {
  if (!value) return null;
  const today = new Date();
  const due = new Date(`${value}T12:00:00`);
  return Math.ceil((due.getTime() - today.getTime()) / 86_400_000);
}

export default async function MissionPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ test?: string }>;
}) {
  const { id } = await params;
  const query = await searchParams;
  const actor = await requirePageActor(`/missions/${id}`);
  const [program, statuses, tenantMembers] = await Promise.all([
    getMissionProgram(actor, id),
    getStatusDefinitions(actor),
    getMembers(actor),
  ]);
  if (!program) notFound();
  const { mission, cycles, tests, team, tasks, requests, circularisations, activity } = program;
  const teamIds = new Set(team.map((member) => member.id));
  const assignableMembers = tenantMembers.map((member) => {
    const missionMember = team.find((item) => item.id === member.id);
    return {
      id: member.id,
      name: member.name,
      initials: member.initials,
      role: missionMember?.role ?? member.grade,
      isLead: missionMember?.isLead ?? 0,
      canReview:
        missionMember?.canReview ??
        Number(["partner", "manager", "senior"].includes(member.grade)),
    };
  });
  const actorMissionRole = team.find((member) => member.id === actor.userId);
  const canManage =
    ["owner", "admin"].includes(actor.accessRole) ||
    Boolean(actorMissionRole?.isLead) ||
    ["partner", "manager"].includes(actorMissionRole?.role ?? "");
  const completed = tests.filter(
    (test) => test.preparationStatus === "completed",
  ).length;
  const pendingReviews = tests.filter(
    (test) => test.reviewStatus === "pending",
  ).length;
  const reportDays = daysUntil(mission.reportDate);

  return (
    <AppShell active="missions" title={mission.client}>
      <nav className="breadcrumb" aria-label="Fil d’Ariane">
        <Link href="/missions">Missions</Link>
        <span>/</span>
        <span>{mission.client} — {mission.fiscalYear}</span>
      </nav>

      <section className="mission-hero">
        <div className="mission-hero-title">
          <span className="client-monogram">
            {mission.client.slice(0, 2).toUpperCase()}
          </span>
          <div>
            <div className="mission-title-row">
              <h2>{mission.title}</h2>
              <StatusPill
                tone={mission.status === "final" ? "success" : "info"}
              >
                {mission.status === "planning"
                  ? "Planification"
                  : mission.status}
              </StatusPill>
            </div>
            <p>
              Clôture {formatDate(mission.closingDate)} · Rapport{" "}
              {formatDate(mission.reportDate)} · AG{" "}
              {formatDate(mission.agDate)}
            </p>
          </div>
        </div>
        <div className="mission-governance">
          {team.slice(0, 4).map((member) => (
            <Person
              key={member.id}
              initials={member.initials}
              name={member.name}
              role={
                member.role === "partner"
                  ? "Associé qui chapote"
                  : member.isLead
                    ? "Responsable de mission"
                    : member.role
              }
            />
          ))}
          {!team.length ? <span>Équipe à constituer</span> : null}
        </div>
      </section>

      <section className="mission-summary-strip">
        <div>
          <span>Tests d’audit</span>
          <strong>{tests.length}</strong>
          <small>{completed} réalisés</small>
        </div>
        <div>
          <span>À revoir</span>
          <strong className="text-warning">{pendingReviews}</strong>
          <small>revues en attente</small>
        </div>
        <div>
          <span>Cycles</span>
          <strong>{cycles.length}</strong>
          <small>configurables</small>
        </div>
        <div>
          <span>Équipe</span>
          <strong>{teamIds.size}</strong>
          <small>collaborateurs</small>
        </div>
        <div className="days-remaining">
          <span>Avant rapport</span>
          <strong>
            {reportDays === null
              ? "À planifier"
              : reportDays >= 0
                ? `${reportDays} jours`
                : `${Math.abs(reportDays)} j. de retard`}
          </strong>
          <small>{formatDate(mission.reportDate)}</small>
        </div>
      </section>

      <section className="mission-control-grid">
        <article className="mission-control-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Rétroplanning</p><h3>Prochaines actions</h3></div>
            <Link href="/planning">Planning</Link>
          </div>
          <div className="mission-mini-list">
            {tasks.slice(0, 4).map((task) => (
              <div key={task.id}>
                <span className={`mini-priority is-${task.priority}`} />
                <span><strong>{task.title}</strong><small>{task.assignee}</small></span>
                <time>{formatDate(task.dueDate)}</time>
              </div>
            ))}
            {!tasks.length ? <p className="form-help">Aucune action ouverte.</p> : null}
          </div>
        </article>

        <article className="mission-control-card">
          <div className="panel-heading">
            <div><p className="eyebrow">Dépendances externes</p><h3>Éléments attendus</h3></div>
            <Link href="/demandes">Suivre</Link>
          </div>
          <div className="mission-mini-list">
            {requests.slice(0, 3).map((request) => (
              <Link href="/demandes" key={request.id}>
                <StatusPill tone="warning">Demande</StatusPill>
                <span><strong>{request.title}</strong><small>{request.status}</small></span>
                <time>{formatDate(request.dueDate)}</time>
              </Link>
            ))}
            {circularisations.slice(0, 2).map((item) => (
              <Link href="/circularisations" key={item.id}>
                <StatusPill tone="info">Circularisation</StatusPill>
                <span><strong>{item.thirdParty}</strong><small>{item.status}</small></span>
                <time>{formatDate(item.nextFollowUpAt)}</time>
              </Link>
            ))}
            {!requests.length && !circularisations.length ? <p className="form-help">Aucun élément externe en attente.</p> : null}
          </div>
        </article>

        <article className="mission-control-card activity-card">
          <div className="panel-heading"><div><p className="eyebrow">Traçabilité</p><h3>Derniers mouvements</h3></div></div>
          <div className="activity-stream">
            {activity.slice(0, 5).map((event) => (
              <div key={event.id}>
                <span />
                <p><strong>{event.actor}</strong> · {event.action.replace(":", " · ")}<small>{event.detail || event.entityType}</small></p>
              </div>
            ))}
            {!activity.length ? <p className="form-help">L’activité de la mission apparaîtra ici.</p> : null}
          </div>
        </article>
      </section>

      <nav className="mission-tabs" aria-label="Sections de la mission">
        <button className="is-active">Programme de travail</button>
        <Link href="/demandes">Demandes client</Link>
        <Link href="/circularisations">Circularisations</Link>
        <Link href="/planning">Planning</Link>
      </nav>

      <TestWorkbench
        actorUserId={actor.userId}
        canManage={canManage}
        cycles={cycles}
        initialTests={tests}
        members={assignableMembers}
        missionId={mission.id}
        initialSelectedId={query.test}
        statuses={statuses}
      />
    </AppShell>
  );
}
