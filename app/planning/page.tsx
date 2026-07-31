import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Person, StatusPill } from "@/components/ui";
import { requirePageActor } from "@/lib/server/core";
import { getPlanning, getStatusDefinitions } from "@/lib/server/queries";

function formatDate(value: string | null) {
  if (!value) return "Non planifiée";
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "short",
    day: "numeric",
    month: "short",
  }).format(new Date(`${value}T12:00:00`));
}

export default async function PlanningPage() {
  const actor = await requirePageActor("/planning");
  const [tests, statuses] = await Promise.all([
    getPlanning(actor),
    getStatusDefinitions(actor),
  ]);
  const today = new Date().toISOString().slice(0, 10);
  const overdue = tests.filter(
    (test) => test.dueDate && test.dueDate < today,
  ).length;
  const reviews = tests.filter((test) => test.reviewStatus === "pending").length;
  const people = new Set(
    tests.flatMap((test) => [test.assigneeId, test.reviewerId]).filter(Boolean),
  ).size;

  return (
    <AppShell active="planning" title="Planning">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Charge issue du programme</p>
          <h2>Planning de l’équipe</h2>
          <p>
            Chaque test assigné alimente automatiquement la charge du
            préparateur et du relecteur.
          </p>
        </div>
        <Link className="primary-link" href="/missions">
          Modifier les affectations
        </Link>
      </section>
      <section className="planning-kpis">
        <div><span>Travaux ouverts</span><strong>{tests.length}</strong><small>tests à préparer ou revoir</small></div>
        <div><span>Échéances dépassées</span><strong className="text-danger">{overdue}</strong><small>à replanifier</small></div>
        <div><span>Revues attendues</span><strong>{reviews}</strong><small>{people} collaborateurs mobilisés</small></div>
      </section>
      <section className="data-panel">
        <div className="panel-heading">
          <h3>Charge planifiée</h3>
        </div>
        {tests.length ? (
          <div className="table-wrap">
            <table className="roomy-table">
              <thead>
                <tr>
                  <th>Échéance</th>
                  <th>Mission / cycle</th>
                  <th>Test</th>
                  <th>Préparateur</th>
                  <th>Avancement</th>
                  <th>Relecteur</th>
                  <th>Revue</th>
                </tr>
              </thead>
              <tbody>
                {tests.map((test) => {
                  const preparation = statuses.find(
                    (status) =>
                      status.stage === "preparation" &&
                      status.code === test.preparationStatus,
                  );
                  const review = statuses.find(
                    (status) =>
                      status.stage === "review" &&
                      status.code === test.reviewStatus,
                  );
                  return (
                    <tr key={test.id}>
                      <td className={test.dueDate && test.dueDate < today ? "text-danger" : ""}>
                        {formatDate(test.dueDate)}
                      </td>
                      <td>
                        <Link className="primary-cell" href={`/missions/${test.missionId}`}>
                          {test.mission}
                        </Link>
                        <small>{test.cycle}</small>
                      </td>
                      <td><span className="test-code">{test.code}</span><span className="primary-cell">{test.title}</span></td>
                      <td><Person initials={test.assigneeInitials ?? "—"} name={test.assignee ?? "Non assigné"} /></td>
                      <td><StatusPill tone={preparation?.color ?? "neutral"}>{preparation?.label ?? test.preparationStatus}</StatusPill></td>
                      <td><Person initials={test.reviewerInitials ?? "—"} name={test.reviewer ?? "Non assigné"} /></td>
                      <td><StatusPill tone={review?.color ?? "neutral"}>{review?.label ?? test.reviewStatus}</StatusPill></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state compact-empty">
            <strong>Aucun travail planifié</strong>
            <p>Assignez des tests et des échéances depuis une mission.</p>
          </div>
        )}
      </section>
    </AppShell>
  );
}
