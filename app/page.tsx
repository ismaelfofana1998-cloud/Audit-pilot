import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { MetricCard, StatusPill } from "@/components/ui";
import { requirePageActor } from "@/lib/server/core";
import { getDashboard, getStatusDefinitions } from "@/lib/server/queries";

function formatDate(value: string | null) {
  if (!value) return "À planifier";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

function toneFor(
  statuses: Awaited<ReturnType<typeof getStatusDefinitions>>,
  stage: "preparation" | "review",
  code: string,
) {
  return (
    statuses.find((status) => status.stage === stage && status.code === code)
      ?.color ?? "neutral"
  );
}

function labelFor(
  statuses: Awaited<ReturnType<typeof getStatusDefinitions>>,
  stage: "preparation" | "review",
  code: string,
) {
  return (
    statuses.find((status) => status.stage === stage && status.code === code)
      ?.label ?? code
  );
}

export default async function Home() {
  const actor = await requirePageActor("/");
  const [dashboard, statuses] = await Promise.all([
    getDashboard(actor),
    getStatusDefinitions(actor),
  ]);
  const today = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date());
  const urgentActions = [
    ...dashboard.tasks.map((task) => ({
      id: `task-${task.id}`,
      label: task.title,
      context: task.mission,
      date: task.dueDate,
      href: `/missions/${task.missionId}`,
      tone: task.priority === "critical" ? "danger" : "warning",
      kind: "Échéance",
    })),
    ...dashboard.requests.map((request) => ({
      id: `request-${request.id}`,
      label: request.title,
      context: request.mission,
      date: request.dueDate,
      href: "/demandes",
      tone: "warning",
      kind: "Demande client",
    })),
  ].slice(0, 7);

  return (
    <AppShell active="dashboard" title={`Bonjour ${actor.fullName.split(" ")[0]}`}>
      <section className="command-hero">
        <div>
          <p className="eyebrow">{today}</p>
          <h2>Les missions restent sous contrôle.</h2>
          <p>
            Priorisez ce qui bloque le rapport, affectez les travaux et gardez
            une trace de chaque validation.
          </p>
        </div>
        <div className="command-hero-actions">
          <Link className="secondary-button" href="/planning">Voir la charge</Link>
          <Link className="primary-link" href="/missions">+ Nouvelle mission</Link>
        </div>
      </section>

      <section className="metrics-grid" aria-label="Indicateurs du portefeuille">
        <MetricCard
          icon="M"
          value={String(dashboard.metrics.missions)}
          label="Missions actives"
          detail="dans le cabinet"
          tone="teal"
        />
        <MetricCard
          icon="J"
          value={String(dashboard.metrics.deadlines)}
          label="Échéances proches"
          detail="rapport ou AG sous 30 jours"
          tone="orange"
        />
        <MetricCard
          icon="D"
          value={String(dashboard.metrics.requests)}
          label="Demandes ouvertes"
          detail="éléments encore attendus"
          tone="blue"
        />
        <MetricCard
          icon="R"
          value={String(dashboard.metrics.reviews)}
          label="Mes revues"
          detail="tests soumis à valider"
          tone="green"
        />
      </section>

      <div className="dashboard-columns dashboard-primary" id="actions">
        <section className="data-panel action-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Chemin critique</p>
              <h3>Actions prioritaires</h3>
              <p>Les travaux susceptibles de retarder une mission.</p>
            </div>
            <span className="panel-count">{urgentActions.length}</span>
          </div>
          {urgentActions.length ? (
            <div className="action-list">
              {urgentActions.map((action) => (
                <Link href={action.href} className="action-row" key={action.id}>
                  <span className={`action-signal is-${action.tone}`} />
                  <span>
                    <small>{action.kind}</small>
                    <strong>{action.label}</strong>
                    <em>{action.context}</em>
                  </span>
                  <time>{formatDate(action.date)}</time>
                  <b aria-hidden="true">→</b>
                </Link>
              ))}
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>Aucune action critique</strong>
              <p>Le chemin critique ne comporte aucun blocage identifié.</p>
            </div>
          )}
        </section>

        <section className="data-panel my-work-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Mon espace</p>
              <h3>Mes tests et revues</h3>
            </div>
            <Link href="/planning">Tout voir</Link>
          </div>
          <div className="my-work-list">
            {dashboard.myTests.slice(0, 6).map((test) => {
              const stage = test.responsibility === "prepare" ? "preparation" : "review";
              const code = stage === "preparation" ? test.preparationStatus : test.reviewStatus;
              return (
                <Link href={`/missions/${test.missionId}?test=${test.id}`} key={test.id}>
                  <span className="test-code">{test.code}</span>
                  <span><strong>{test.title}</strong><small>{test.mission} · {test.cycle}</small></span>
                  <StatusPill tone={toneFor(statuses, stage, code)}>{labelFor(statuses, stage, code)}</StatusPill>
                </Link>
              );
            })}
            {!dashboard.myTests.length ? <p className="form-help">Aucun travail en attente.</p> : null}
          </div>
        </section>
      </div>

      <section className="data-panel portfolio-control">
        <div className="panel-heading">
          <div><p className="eyebrow">Portefeuille</p><h3>Santé des missions</h3></div>
          <Link href="/missions">Ouvrir le portefeuille</Link>
        </div>
        {dashboard.portfolio.length ? (
          <div className="table-wrap">
            <table className="portfolio-table">
              <thead>
                <tr>
                  <th>Mission</th><th>Rapport</th><th>Avancement</th><th>Revues</th><th>Demandes en retard</th><th>Santé</th>
                </tr>
              </thead>
              <tbody>
                {dashboard.portfolio.map((mission) => (
                  <tr key={mission.id}>
                    <td><Link className="primary-cell" href={`/missions/${mission.id}`}>{mission.client}</Link><small>{mission.title}</small></td>
                    <td>{formatDate(mission.reportDate)}</td>
                    <td><div className="table-progress"><span><i style={{ width: `${mission.progress}%` }} /></span><strong>{mission.progress}%</strong></div></td>
                    <td>{mission.pendingReviews}</td>
                    <td className={mission.overdueRequests ? "text-danger" : ""}>{mission.overdueRequests}</td>
                    <td><StatusPill tone={mission.health}>{mission.health === "danger" ? "À risque" : mission.health === "warning" ? "À surveiller" : "Maîtrisée"}</StatusPill></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>Aucune mission active</strong>
            <p>Créez une mission pour initialiser son rétroplanning.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
