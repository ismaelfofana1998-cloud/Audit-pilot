"use client";

import { FormEvent, useState } from "react";
import { Person, StatusPill } from "@/components/ui";
import type { MemberView, StatusDefinition } from "@/lib/server/queries";

type Invitation = {
  id: string;
  name: string;
  email: string;
  grade: string;
  access: string;
  status: string;
  createdAt: string;
};

const gradeLabels: Record<string, string> = {
  partner: "Associé",
  manager: "Manager",
  senior: "Senior",
  junior: "Junior",
  intern: "Stagiaire",
};
const accessLabels: Record<string, string> = {
  owner: "Propriétaire",
  admin: "Administrateur",
  member: "Membre",
};

export function TenantManager({
  initialMembers,
  initialInvitations,
  initialStatuses,
  canAdmin,
  tenantName,
}: {
  initialMembers: MemberView[];
  initialInvitations: Invitation[];
  initialStatuses: StatusDefinition[];
  canAdmin: boolean;
  tenantName: string;
}) {
  const [members] = useState(initialMembers);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [statuses, setStatuses] = useState(initialStatuses);
  const [open, setOpen] = useState<"member" | "status" | null>(null);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState("");

  async function inviteMember(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/tenant/members", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as {
      error?: string;
      invitation?: Invitation;
    };
    if (!response.ok || !result.invitation) {
      setError(result.error ?? "L’invitation n’a pas pu être créée.");
      return;
    }
    setInvitations((current) => [
      result.invitation!,
      ...current.filter((item) => item.email !== result.invitation!.email),
    ]);
    setOpen(null);
    setSaved(
      `${result.invitation.name} rejoindra le cabinet à sa première connexion.`,
    );
  }

  async function createStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/test-statuses", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as {
      error?: string;
      status?: StatusDefinition;
    };
    if (!response.ok || !result.status) {
      setError(result.error ?? "Le statut n’a pas pu être créé.");
      return;
    }
    setStatuses((current) =>
      [...current, result.status!].sort(
        (a, b) =>
          a.stage.localeCompare(b.stage) || a.sortOrder - b.sortOrder,
      ),
    );
    setOpen(null);
    setSaved("Le nouveau statut est disponible dans les listes du programme.");
  }

  return (
    <>
      <section className="data-panel tenant-members">
        <div className="panel-heading">
          <div>
            <h3>Membres du cabinet</h3>
            <p>
              Le grade professionnel est distinct du niveau d’accès au cabinet.
            </p>
          </div>
          {canAdmin ? (
            <button
              className="primary-button"
              onClick={() => {
                setError("");
                setOpen("member");
              }}
              type="button"
            >
              + Inviter un membre
            </button>
          ) : null}
        </div>
        {saved ? <p className="inline-notice">{saved}</p> : null}
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Collaborateur</th>
                <th>Grade professionnel</th>
                <th>Accès tenant</th>
                <th>Missions actives</th>
                <th>Statut</th>
              </tr>
            </thead>
            <tbody>
              {members.map((member) => (
                <tr key={member.id}>
                  <td>
                    <Person
                      initials={member.initials}
                      name={member.name}
                      role={member.email}
                    />
                  </td>
                  <td>{gradeLabels[member.grade] ?? member.grade}</td>
                  <td>
                    <StatusPill
                      tone={member.access === "owner" ? "info" : "neutral"}
                    >
                      {accessLabels[member.access] ?? member.access}
                    </StatusPill>
                  </td>
                  <td>{member.missions}</td>
                  <td>
                    <StatusPill tone="success">Actif</StatusPill>
                  </td>
                </tr>
              ))}
              {invitations.map((invitation) => (
                <tr className="pending-row" key={invitation.id}>
                  <td>
                    <Person
                      initials={initials(invitation.name)}
                      name={invitation.name}
                      role={invitation.email}
                    />
                  </td>
                  <td>{gradeLabels[invitation.grade] ?? invitation.grade}</td>
                  <td>{accessLabels[invitation.access] ?? invitation.access}</td>
                  <td>—</td>
                  <td>
                    <StatusPill tone="warning">Invitation en attente</StatusPill>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="data-panel status-settings">
        <div className="panel-heading">
          <div>
            <h3>Statuts des tests</h3>
            <p>
              Deux listes paramétrables : l’avancement du préparateur et la
              décision de revue.
            </p>
          </div>
          {canAdmin ? (
            <button
              className="secondary-button"
              onClick={() => {
                setError("");
                setOpen("status");
              }}
              type="button"
            >
              + Ajouter un statut
            </button>
          ) : null}
        </div>
        <div className="status-columns">
          {(["preparation", "review"] as const).map((stage) => (
            <div key={stage}>
              <span className="micro-label">
                {stage === "preparation"
                  ? "Avancement du préparateur"
                  : "Statut de la revue"}
              </span>
              <div className="status-chip-list">
                {statuses
                  .filter((status) => status.stage === stage)
                  .map((status) => (
                    <StatusPill key={status.id} tone={status.color}>
                      {status.label}
                    </StatusPill>
                  ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {open === "member" ? (
        <Dialog
          eyebrow={tenantName}
          title="Inviter un collaborateur"
          onClose={() => setOpen(null)}
        >
          <form className="member-form" onSubmit={inviteMember}>
            <label className="field-label">
              Nom complet
              <input className="text-field" name="name" required />
            </label>
            <label className="field-label">
              Adresse e-mail
              <input className="text-field" name="email" required type="email" />
            </label>
            <div className="form-grid">
              <label className="field-label">
                Grade professionnel
                <select className="text-field" name="professionalGrade">
                  <option value="partner">Associé</option>
                  <option value="manager">Manager</option>
                  <option value="senior">Senior</option>
                  <option value="junior">Junior</option>
                  <option value="intern">Stagiaire</option>
                </select>
              </label>
              <label className="field-label">
                Accès au tenant
                <select className="text-field" name="accessRole">
                  <option value="member">Membre</option>
                  <option value="admin">Administrateur</option>
                </select>
              </label>
            </div>
            <p className="form-help">
              L’invitation sera acceptée automatiquement à la première
              connexion avec cette adresse.
            </p>
            {error ? <p className="error-message">{error}</p> : null}
            <DialogActions onClose={() => setOpen(null)} label="Inviter" />
          </form>
        </Dialog>
      ) : null}

      {open === "status" ? (
        <Dialog
          eyebrow="Programme de travail"
          title="Ajouter un statut"
          onClose={() => setOpen(null)}
        >
          <form className="member-form" onSubmit={createStatus}>
            <div className="form-grid">
              <label className="field-label">
                Liste concernée
                <select className="text-field" name="stage">
                  <option value="preparation">Avancement</option>
                  <option value="review">Revue</option>
                </select>
              </label>
              <label className="field-label">
                Couleur
                <select className="text-field" name="color">
                  <option value="neutral">Neutre</option>
                  <option value="info">Information</option>
                  <option value="warning">Attention</option>
                  <option value="success">Validé</option>
                  <option value="danger">Bloquant</option>
                </select>
              </label>
            </div>
            <label className="field-label">
              Libellé
              <input
                className="text-field"
                name="label"
                placeholder="Bloqué — pièce manquante"
                required
              />
            </label>
            <label className="field-label">
              Code interne
              <input
                className="text-field"
                name="code"
                placeholder="blocked_missing_evidence"
                required
              />
            </label>
            {error ? <p className="error-message">{error}</p> : null}
            <DialogActions onClose={() => setOpen(null)} label="Créer" />
          </form>
        </Dialog>
      ) : null}
    </>
  );
}

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function Dialog({
  eyebrow,
  title,
  children,
  onClose,
}: {
  eyebrow: string;
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <div className="modal-backdrop" role="presentation">
      <section aria-modal="true" className="modal-card" role="dialog">
        <div className="modal-heading">
          <div>
            <p className="eyebrow">{eyebrow}</p>
            <h3>{title}</h3>
          </div>
          <button
            aria-label="Fermer"
            className="row-action"
            onClick={onClose}
            type="button"
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}

function DialogActions({
  onClose,
  label,
}: {
  onClose: () => void;
  label: string;
}) {
  return (
    <div className="modal-actions">
      <button className="secondary-button" onClick={onClose} type="button">
        Annuler
      </button>
      <button className="primary-button" type="submit">
        {label}
      </button>
    </div>
  );
}
