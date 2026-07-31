"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Person, StatusPill } from "@/components/ui";

type RequestItem = {
  id: string;
  missionId: string;
  mission: string;
  title: string;
  contact: string;
  contactEmail: string;
  ownerId: string;
  owner: string;
  initials: string;
  priority: string;
  status: string;
  plannedSendDate: string;
  dueDate: string;
  sentAt: string;
  receivedAt: string;
  emailLink: string;
  documentLink: string;
  notes: string;
};

type Option = { id: string; name: string };

const requestStatuses = [
  ["draft", "Brouillon"],
  ["sent", "Envoyée"],
  ["partially_received", "Partiellement reçue"],
  ["received", "Reçue"],
  ["validated", "Reçue et contrôlée"],
  ["closed", "Clôturée"],
] as const;

function statusLabel(code: string) {
  return requestStatuses.find(([value]) => value === code)?.[1] ?? code;
}

function statusTone(code: string) {
  if (["received", "validated", "closed"].includes(code)) return "success" as const;
  if (code === "partially_received") return "warning" as const;
  if (code === "sent") return "info" as const;
  return "neutral" as const;
}

export function RequestManager({
  initialRequests,
  missions,
  members,
}: {
  initialRequests: RequestItem[];
  missions: Option[];
  members: Option[];
}) {
  const router = useRouter();
  const [requests, setRequests] = useState(initialRequests);
  const [selectedId, setSelectedId] = useState(initialRequests[0]?.id ?? "");
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const selected = requests.find((item) => item.id === selectedId);
  const counts = useMemo(
    () => ({
      waiting: requests.filter((item) =>
        ["draft", "sent", "partially_received"].includes(item.status),
      ).length,
      late: requests.filter(
        (item) =>
          item.dueDate &&
          item.dueDate < new Date().toISOString().slice(0, 10) &&
          !["received", "validated", "closed"].includes(item.status),
      ).length,
      partial: requests.filter(
        (item) => item.status === "partially_received",
      ).length,
      received: requests.filter((item) =>
        ["received", "validated", "closed"].includes(item.status),
      ).length,
    }),
    [requests],
  );

  async function patchRequest(id: string, patch: Partial<RequestItem>) {
    setError("");
    const response = await fetch(`/api/requests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        status: patch.status,
        emailLink: patch.emailLink,
        documentLink: patch.documentLink,
        notes: patch.notes,
        dueDate: patch.dueDate,
      }),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Modification non enregistrée.");
      return;
    }
    setRequests((current) =>
      current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
    );
    setMessage("Demande mise à jour et ajoutée à l’historique.");
  }

  async function createRequest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/requests", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "La demande n’a pas pu être créée.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <section className="page-title-row">
        <div>
          <p className="eyebrow">PBC & éléments à obtenir</p>
          <h2>Suivi des demandes</h2>
          <p>
            Préparer, envoyer, relancer, confirmer la réception et conserver le
            lien du fil de mail.
          </p>
        </div>
        <button
          className="primary-button"
          onClick={() => setOpen(true)}
          type="button"
        >
          + Nouvelle demande
        </button>
      </section>
      <section className="request-kpis">
        <div><strong>{counts.waiting}</strong><span>En attente</span></div>
        <div><strong className="text-danger">{counts.late}</strong><span>En retard</span></div>
        <div><strong>{counts.partial}</strong><span>Partielles</span></div>
        <div><strong className="text-success">{counts.received}</strong><span>Reçues / contrôlées</span></div>
      </section>
      {message ? <p className="inline-notice">{message}</p> : null}
      {error ? <p className="error-message">{error}</p> : null}

      <div className="requests-layout">
        <section className="data-panel">
          <div className="panel-heading">
            <h3>Toutes les demandes</h3>
          </div>
          {requests.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Demande</th>
                    <th>Mission</th>
                    <th>Responsable</th>
                    <th>Échéance</th>
                    <th>Statut</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.map((item) => (
                    <tr
                      className={selectedId === item.id ? "selected-table-row" : ""}
                      key={item.id}
                      onClick={() => setSelectedId(item.id)}
                    >
                      <td>
                        <span className="request-id">{item.id.slice(0, 12)}</span>
                        <span className="primary-cell">{item.title}</span>
                      </td>
                      <td>{item.mission}</td>
                      <td><Person initials={item.initials} name={item.owner} /></td>
                      <td>{item.dueDate || "—"}</td>
                      <td>
                        <StatusPill tone={statusTone(item.status)}>
                          {statusLabel(item.status)}
                        </StatusPill>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="empty-state compact-empty">
              <strong>Aucune demande</strong>
              <p>Créez la première liste de pièces à obtenir.</p>
            </div>
          )}
        </section>

        {selected ? (
          <aside className="request-detail-card">
            <div className="detail-heading">
              <div>
                <span className="test-code">{selected.id.slice(0, 12)}</span>
                <h3>{selected.title}</h3>
              </div>
              <StatusPill tone={statusTone(selected.status)}>
                {statusLabel(selected.status)}
              </StatusPill>
            </div>
            <dl className="request-facts">
              <div><dt>Mission</dt><dd>{selected.mission}</dd></div>
              <div><dt>Destinataire</dt><dd>{selected.contact}</dd></div>
              <div><dt>Échéance</dt><dd>{selected.dueDate || "—"}</dd></div>
            </dl>
            <label className="field-label">
              Statut
              <select
                className="text-field"
                onChange={(event) =>
                  patchRequest(selected.id, { status: event.target.value })
                }
                value={selected.status}
              >
                {requestStatuses.map(([value, label]) => (
                  <option key={value} value={value}>{label}</option>
                ))}
              </select>
            </label>
            <label className="field-label">
              Lien vers le fil de mail
              <input
                className="text-field"
                defaultValue={selected.emailLink}
                onBlur={(event) =>
                  patchRequest(selected.id, { emailLink: event.target.value })
                }
                placeholder="Lien Outlook ou Gmail"
                type="url"
              />
            </label>
            <label className="field-label">
              Lien vers les pièces reçues
              <input
                className="text-field"
                defaultValue={selected.documentLink}
                onBlur={(event) =>
                  patchRequest(selected.id, { documentLink: event.target.value })
                }
                placeholder="SharePoint, Drive ou dossier d’audit"
                type="url"
              />
            </label>
            <label className="field-label">
              Notes de suivi
              <textarea
                className="text-field detail-textarea"
                defaultValue={selected.notes}
                onBlur={(event) =>
                  patchRequest(selected.id, { notes: event.target.value })
                }
              />
            </label>
            <button
              className="primary-button full-button"
              onClick={() => patchRequest(selected.id, { status: "received" })}
              type="button"
            >
              Marquer comme reçue
            </button>
          </aside>
        ) : null}
      </div>

      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card modal-card-wide" role="dialog">
            <div className="modal-heading">
              <div><p className="eyebrow">Éléments à obtenir</p><h3>Nouvelle demande</h3></div>
              <button className="row-action" onClick={() => setOpen(false)} type="button">×</button>
            </div>
            <form className="member-form" onSubmit={createRequest}>
              <div className="form-grid">
                <label className="field-label">
                  Mission
                  <select className="text-field" name="missionId" required>
                    <option value="">Choisir</option>
                    {missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}
                  </select>
                </label>
                <label className="field-label">
                  Responsable
                  <select className="text-field" name="ownerUserId">
                    {members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}
                  </select>
                </label>
              </div>
              <label className="field-label">Élément demandé<input className="text-field" name="title" required /></label>
              <div className="form-grid">
                <label className="field-label">Destinataire<input className="text-field" name="recipientName" /></label>
                <label className="field-label">E-mail<input className="text-field" name="recipientEmail" type="email" /></label>
              </div>
              <div className="form-grid">
                <label className="field-label">Envoi prévu<input className="text-field" name="plannedSendDate" type="date" /></label>
                <label className="field-label">Échéance<input className="text-field" name="dueDate" type="date" /></label>
              </div>
              {error ? <p className="error-message">{error}</p> : null}
              <div className="modal-actions">
                <button className="secondary-button" onClick={() => setOpen(false)} type="button">Annuler</button>
                <button className="primary-button" type="submit">Créer la demande</button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
