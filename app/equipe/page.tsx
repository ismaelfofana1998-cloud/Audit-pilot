import Link from "next/link";
import { AppShell } from "@/components/app-shell";
import { Avatar, StatusPill } from "@/components/ui";
import { requirePageActor } from "@/lib/server/core";
import { getMembers } from "@/lib/server/queries";

const gradeLabels: Record<string, string> = {
  partner: "Associé",
  manager: "Manager",
  senior: "Senior",
  junior: "Junior",
  intern: "Stagiaire",
};

const roleLabels: Record<string, string> = {
  partner: "Supervision & signature",
  manager: "Pilotage & revue",
  senior: "Responsable de mission",
  junior: "Préparation des travaux",
  intern: "Assistance aux travaux",
};

export default async function TeamPage() {
  const actor = await requirePageActor("/equipe");
  const members = await getMembers(actor);
  return (
    <AppShell active="team" title="Équipe">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Capacité & responsabilités</p>
          <h2>Équipe du cabinet</h2>
          <p>
            Les affectations aux tests et aux revues alimentent directement la
            charge de chaque collaborateur.
          </p>
        </div>
        <Link className="primary-link" href="/missions">
          Affecter dans une mission
        </Link>
      </section>

      <section className="team-grid">
        {members.map((member) => (
          <article className="team-card" key={member.id}>
            <div className="team-card-heading">
              <Avatar initials={member.initials} tone="ink" />
              <div>
                <h3>{member.name}</h3>
                <p>{gradeLabels[member.grade] ?? member.grade}</p>
              </div>
              <StatusPill tone="success">Actif</StatusPill>
            </div>
            <p className="team-role">
              {roleLabels[member.grade] ?? "Membre de l’équipe"}
            </p>
            <dl className="team-facts">
              <div>
                <dt>Missions</dt>
                <dd>{member.missions}</dd>
              </div>
              <div>
                <dt>Accès</dt>
                <dd>{member.access}</dd>
              </div>
              <div>
                <dt>Grade</dt>
                <dd>{gradeLabels[member.grade] ?? member.grade}</dd>
              </div>
            </dl>
          </article>
        ))}
        {!members.length ? (
          <div className="empty-state">
            <strong>Aucun collaborateur</strong>
            <p>Invitez l’équipe depuis la page Cabinet & rôles.</p>
          </div>
        ) : null}
      </section>

      <section className="future-module">
        <div>
          <p className="eyebrow">Évolution prévue</p>
          <h3>Objectifs et développement des collaborateurs</h3>
          <p>
            Le profil, le grade, les rôles de mission et l’activité sont
            séparés. Les objectifs individuels, compétences et feedbacks
            pourront s’y rattacher sans modifier le cœur des missions.
          </p>
        </div>
        <StatusPill tone="info">Architecture prête</StatusPill>
      </section>
    </AppShell>
  );
}
