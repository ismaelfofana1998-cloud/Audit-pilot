import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MissionCreator } from "@/components/mission-creator";
import { Person, StatusPill } from "@/components/ui";
import { requirePageActor } from "@/lib/server/core";
import { getMembers, getMissions } from "@/lib/server/queries";

function formatDate(value: string | null) {
  if (!value) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function statusLabel(value: string) {
  return (
    {
      planning: "Planification",
      interim: "Intérim",
      final: "Final",
      reporting: "Rapport",
      closed: "Clôturée",
    }[value] ?? value
  );
}

export default async function MissionsPage() {
  const actor = await requirePageActor("/missions");
  const [missions, members] = await Promise.all([
    getMissions(actor),
    getMembers(actor),
  ]);
  return (
    <AppShell active="missions" title="Missions">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Portefeuille 2026</p>
          <h2>Toutes les missions</h2>
          <p>
            Pilotage des échéances, de l’équipe et des travaux jusqu’à chaque
            test d’audit assigné.
          </p>
        </div>
        <MissionCreator members={members} />
      </section>

      <section className="portfolio-toolbar">
        <div className="portfolio-statuses">
          <StatusPill tone="neutral">
            {missions.filter((mission) => mission.status === "planning").length} en planification
          </StatusPill>
          <StatusPill tone="info">
            {missions.filter((mission) => ["interim", "final"].includes(mission.status)).length} en intervention
          </StatusPill>
          <StatusPill tone="warning">
            {missions.reduce((total, mission) => total + mission.pendingReviews, 0)} revues à traiter
          </StatusPill>
        </div>
        <span>{missions.length} mission{missions.length > 1 ? "s" : ""} affichée{missions.length > 1 ? "s" : ""}</span>
      </section>

      <section className="mission-grid">
        {!missions.length ? (
          <div className="empty-state">
            <strong>Aucune mission dans ce cabinet</strong>
            <p>
              Créez votre première mission, définissez ses échéances puis
              configurez son programme de travail.
            </p>
          </div>
        ) : null}
        {missions.map((mission) => (
          <article className="mission-card" key={mission.id}>
            <div className="mission-card-heading">
              <div>
                <span className="client-tag">
                  {mission.client.slice(0, 2).toUpperCase()}
                </span>
                <div>
                  <p>{mission.client}</p>
                  <h3>{mission.title}</h3>
                </div>
              </div>
              <StatusPill
                tone={
                  mission.status === "final"
                    ? "success"
                    : mission.status === "interim"
                      ? "info"
                      : "neutral"
                }
              >
                {statusLabel(mission.status)}
              </StatusPill>
            </div>
            <div className="mission-card-team">
              <Person
                initials={mission.leadInitials}
                name={mission.lead}
                role="Chef de mission"
              />
              <span>
                <small>Associé qui chapote</small>
                <strong>{mission.partner}</strong>
              </span>
            </div>
            <dl className="mission-card-dates">
              <div>
                <dt>Rapport</dt>
                <dd>{formatDate(mission.reportDate)}</dd>
              </div>
              <div>
                <dt>AG</dt>
                <dd>{formatDate(mission.agDate)}</dd>
              </div>
              <div>
                <dt>Points critiques</dt>
                <dd className={mission.pendingReviews + mission.openRequests ? "text-danger" : ""}>
                  {mission.pendingReviews + mission.openRequests}
                </dd>
              </div>
            </dl>
            <div className="progress-heading">
              <span>Avancement opérationnel</span>
              <strong>
                {mission.tests
                  ? Math.round((mission.completedTests / mission.tests) * 100)
                  : 0}
                %
              </strong>
            </div>
            <div className="progress-track">
              <span
                style={{
                  width: `${
                    mission.tests
                      ? Math.round(
                          (mission.completedTests / mission.tests) * 100,
                        )
                      : 0
                  }%`,
                }}
              />
            </div>
            <Link
              className="mission-open-link"
              href={`/missions/${mission.id}`}
            >
              Ouvrir le cockpit <span aria-hidden="true">→</span>
            </Link>
          </article>
        ))}
      </section>
    </AppShell>
  );
}
