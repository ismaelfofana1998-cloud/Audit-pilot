import { AppShell } from "@/components/app-shell";
import { TenantManager } from "@/components/tenant-manager";
import { StatusPill } from "@/components/ui";
import { isTenantAdmin, requirePageActor } from "@/lib/server/core";
import {
  getMembers,
  getStatusDefinitions,
  getTenantSummary,
} from "@/lib/server/queries";

export default async function TenantPage() {
  const actor = await requirePageActor("/tenant");
  const [members, statuses, summary] = await Promise.all([
    getMembers(actor),
    getStatusDefinitions(actor),
    getTenantSummary(actor),
  ]);
  if (!summary.tenant) return null;
  return (
    <AppShell active="tenant" title="Cabinet & rôles">
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Administration du tenant</p>
          <h2>{summary.tenant.name}</h2>
          <p>
            Isolation des données du cabinet, membres, grades professionnels et
            droits d’administration.
          </p>
        </div>
        <StatusPill tone="success">Tenant actif</StatusPill>
      </section>

      <section className="tenant-overview">
        <article>
          <span className="tenant-logo">
            {summary.tenant.name
              .split(/\s+/)
              .slice(0, 2)
              .map((part) => part[0]?.toUpperCase())
              .join("")}
          </span>
          <div>
            <h3>{summary.tenant.name}</h3>
            <p>{summary.tenant.timezone} · Données isolées par tenant</p>
          </div>
        </article>
        <dl>
          <div>
            <dt>Membres</dt>
            <dd>{summary.counts?.members ?? 0}</dd>
          </div>
          <div>
            <dt>Missions actives</dt>
            <dd>{summary.counts?.missions ?? 0}</dd>
          </div>
          <div>
            <dt>Administrateurs</dt>
            <dd>{summary.counts?.admins ?? 0}</dd>
          </div>
        </dl>
      </section>

      <section className="role-model">
        <div>
          <span className="role-number">1</span>
          <div>
            <h3>Accès au tenant</h3>
            <p>Propriétaire, administrateur ou membre.</p>
          </div>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span className="role-number">2</span>
          <div>
            <h3>Grade professionnel</h3>
            <p>Associé, manager, senior, junior ou stagiaire.</p>
          </div>
        </div>
        <span aria-hidden="true">→</span>
        <div>
          <span className="role-number">3</span>
          <div>
            <h3>Rôle sur la mission</h3>
            <p>Associé qui chapote, chef, préparateur ou relecteur.</p>
          </div>
        </div>
      </section>

      <TenantManager
        canAdmin={isTenantAdmin(actor)}
        initialInvitations={summary.invitations as never[]}
        initialMembers={members}
        initialStatuses={statuses}
        tenantName={summary.tenant.name}
      />

      <section className="permission-matrix data-panel">
        <div className="panel-heading">
          <div>
            <h3>Principes de contrôle</h3>
            <p>Règles appliquées aux changements d’état sensibles.</p>
          </div>
        </div>
        <div className="permission-grid">
          <div>
            <strong>Isolation tenant</strong>
            <p>
              Chaque enregistrement porte son tenant et toutes les opérations
              serveur sont filtrées sur ce périmètre.
            </p>
          </div>
          <div>
            <strong>Séparation préparation / revue</strong>
            <p>
              Un test soumis doit être revu par une autre personne autorisée.
            </p>
          </div>
          <div>
            <strong>Traçabilité</strong>
            <p>
              Les validations sont horodatées avec l’auteur et conservées dans
              le journal d’activité.
            </p>
          </div>
          <div>
            <strong>Évolutivité</strong>
            <p>
              Les grades et rôles de mission restent distincts pour accueillir
              objectifs, feedbacks et compétences.
            </p>
          </div>
        </div>
      </section>
    </AppShell>
  );
}
