"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Person, StatusPill } from "@/components/ui";

type Item = {
  id: string;
  missionId: string;
  mission: string;
  type: string;
  thirdParty: string;
  contactEmail: string;
  ownerId: string;
  owner: string;
  initials: string;
  status: string;
  sentAt: string;
  responseAt: string;
  nextFollowUpAt: string;
  alternativeProcedure: string;
  evidenceLink: string;
  notes: string;
};
type Option = { id: string; name: string };

const statuses = [
  ["draft", "À préparer"],
  ["sent", "Envoyée"],
  ["follow_up_1", "Relance 1"],
  ["follow_up_2", "Relance 2"],
  ["no_response", "Sans réponse"],
  ["response_received", "Réponse reçue"],
  ["alternative_procedure", "Procédure alternative"],
  ["closed", "Clôturée"],
] as const;

function tone(code: string) {
  if (["response_received", "closed"].includes(code)) return "success" as const;
  if (["no_response", "alternative_procedure"].includes(code)) return "danger" as const;
  if (code.startsWith("follow_up")) return "warning" as const;
  return code === "sent" ? ("info" as const) : ("neutral" as const);
}

export function CircularisationManager({
  initialItems,
  missions,
  members,
}: {
  initialItems: Item[];
  missions: Option[];
  members: Option[];
}) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const counts = useMemo(
    () => ({
      total: items.length,
      received: items.filter((item) => item.status === "response_received").length,
      unanswered: items.filter((item) =>
        ["sent", "follow_up_1", "follow_up_2", "no_response"].includes(item.status),
      ).length,
      alternatives: items.filter(
        (item) => item.status === "alternative_procedure",
      ).length,
    }),
    [items],
  );

  async function patch(id: string, values: Partial<Item>) {
    const response = await fetch(`/api/circularisations/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(values),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Modification non enregistrée.");
      return;
    }
    setItems((current) =>
      current.map((item) => (item.id === id ? { ...item, ...values } : item)),
    );
  }

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/circularisations", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Création impossible.");
      return;
    }
    setOpen(false);
    router.refresh();
  }

  return (
    <>
      <section className="page-title-row">
        <div>
          <p className="eyebrow">Confirmations externes</p>
          <h2>Campagnes de circularisation</h2>
          <p>
            Préparer, envoyer, relancer puis documenter la réponse ou la
            procédure alternative.
          </p>
        </div>
        <button className="primary-button" onClick={() => setOpen(true)} type="button">
          + Ajouter un tiers
        </button>
      </section>
      <section className="request-kpis">
        <div><strong>{counts.total}</strong><span>Tiers circularisés</span></div>
        <div><strong className="text-success">{counts.received}</strong><span>Réponses reçues</span></div>
        <div><strong className="text-danger">{counts.unanswered}</strong><span>Sans réponse</span></div>
        <div><strong>{counts.alternatives}</strong><span>Procédures alternatives</span></div>
      </section>
      {error ? <p className="error-message">{error}</p> : null}
      <section className="data-panel">
        <div className="panel-heading"><h3>Suivi détaillé</h3></div>
        {items.length ? (
          <div className="table-wrap">
            <table className="roomy-table">
              <thead>
                <tr><th>Type / tiers</th><th>Mission</th><th>Responsable</th><th>Envoi</th><th>Prochaine action</th><th>Statut</th><th>Alternative / preuve</th></tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id}>
                    <td><StatusPill tone="info">{item.type}</StatusPill><span className="primary-cell">{item.thirdParty}</span></td>
                    <td>{item.mission}</td>
                    <td><Person initials={item.initials} name={item.owner} /></td>
                    <td>{item.sentAt ? item.sentAt.slice(0, 10) : "—"}</td>
                    <td><input className="inline-date" defaultValue={item.nextFollowUpAt?.slice(0, 10)} onBlur={(event) => patch(item.id, { nextFollowUpAt: event.target.value })} type="date" /></td>
                    <td>
                      <select className={`status-select status-${tone(item.status)}`} onChange={(event) => patch(item.id, { status: event.target.value })} value={item.status}>
                        {statuses.map(([value, text]) => <option key={value} value={value}>{text}</option>)}
                      </select>
                    </td>
                    <td>
                      <input className="inline-select" defaultValue={item.evidenceLink || item.alternativeProcedure} onBlur={(event) => patch(item.id, item.status === "alternative_procedure" ? { alternativeProcedure: event.target.value } : { evidenceLink: event.target.value })} placeholder="Lien ou procédure" />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty-state compact-empty"><strong>Aucune circularisation</strong><p>Ajoutez les banques, avocats, clients ou fournisseurs à confirmer.</p></div>
        )}
      </section>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section aria-modal="true" className="modal-card" role="dialog">
            <div className="modal-heading">
              <div><p className="eyebrow">Nouvelle confirmation</p><h3>Ajouter un tiers</h3></div>
              <button className="row-action" onClick={() => setOpen(false)} type="button">×</button>
            </div>
            <form className="member-form" onSubmit={create}>
              <label className="field-label">Mission<select className="text-field" name="missionId" required><option value="">Choisir</option>{missions.map((mission) => <option key={mission.id} value={mission.id}>{mission.name}</option>)}</select></label>
              <div className="form-grid">
                <label className="field-label">Type<select className="text-field" name="type"><option value="bank">Banque</option><option value="lawyer">Avocat</option><option value="customer">Client</option><option value="supplier">Fournisseur</option><option value="other">Autre</option></select></label>
                <label className="field-label">Tiers<input className="text-field" name="thirdParty" required /></label>
              </div>
              <label className="field-label">Contact e-mail<input className="text-field" name="contactEmail" type="email" /></label>
              <div className="form-grid">
                <label className="field-label">Responsable<select className="text-field" name="ownerUserId">{members.map((member) => <option key={member.id} value={member.id}>{member.name}</option>)}</select></label>
                <label className="field-label">Prochaine action<input className="text-field" name="nextFollowUpAt" type="date" /></label>
              </div>
              {error ? <p className="error-message">{error}</p> : null}
              <div className="modal-actions"><button className="secondary-button" onClick={() => setOpen(false)} type="button">Annuler</button><button className="primary-button" type="submit">Ajouter</button></div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}
