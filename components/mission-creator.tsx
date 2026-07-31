"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

type MemberOption = { id: string; name: string; grade: string };

export function MissionCreator({ members }: { members: MemberOption[] }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch("/api/missions", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as {
      missionId?: string;
      error?: string;
    };
    if (!response.ok || !result.missionId) {
      setError(result.error ?? "La mission n’a pas pu être créée.");
      setBusy(false);
      return;
    }
    router.push(`/missions/${result.missionId}`);
    router.refresh();
  }

  return (
    <>
      <button
        className="primary-button"
        onClick={() => setOpen(true)}
        type="button"
      >
        + Nouvelle mission
      </button>
      {open ? (
        <div className="modal-backdrop" role="presentation">
          <section
            aria-labelledby="mission-modal-title"
            aria-modal="true"
            className="modal-card modal-card-wide"
            role="dialog"
          >
            <div className="modal-heading">
              <div>
                <p className="eyebrow">Nouveau dossier</p>
                <h3 id="mission-modal-title">Créer une mission</h3>
              </div>
              <button
                aria-label="Fermer"
                className="row-action"
                onClick={() => setOpen(false)}
                type="button"
              >
                ×
              </button>
            </div>
            <form className="member-form" onSubmit={submit}>
              <div className="form-grid">
                <label className="field-label">
                  Client
                  <input className="text-field" name="clientName" required />
                </label>
                <label className="field-label">
                  Exercice
                  <input
                    className="text-field"
                    defaultValue="2026"
                    name="fiscalYear"
                    pattern="\d{4}"
                    required
                  />
                </label>
              </div>
              <label className="field-label">
                Intitulé de la mission
                <input
                  className="text-field"
                  name="title"
                  placeholder="Audit légal 2026"
                  required
                />
              </label>
              <div className="form-grid">
                <label className="field-label">
                  Type
                  <select className="text-field" name="missionType">
                    <option value="audit_legal">Audit légal</option>
                    <option value="audit_contractuel">Audit contractuel</option>
                    <option value="examen_limite">Examen limité</option>
                  </select>
                </label>
                <label className="field-label">
                  Niveau de risque
                  <select className="text-field" name="riskLevel">
                    <option value="normal">Normal</option>
                    <option value="high">Élevé</option>
                    <option value="critical">Critique</option>
                  </select>
                </label>
              </div>
              <div className="date-form-grid">
                {[
                  ["closingDate", "Clôture"],
                  ["interimDate", "Intérim"],
                  ["finalDate", "Final"],
                  ["reportDate", "Rapport"],
                  ["agDate", "AG"],
                ].map(([name, label]) => (
                  <label className="field-label" key={name}>
                    {label}
                    <input className="text-field" name={name} type="date" />
                  </label>
                ))}
              </div>
              <div className="form-grid form-grid-three">
                <MemberSelect
                  label="Associé qui chapote"
                  members={members.filter((member) => member.grade === "partner")}
                  name="partnerUserId"
                />
                <MemberSelect
                  label="Manager"
                  members={members.filter((member) => member.grade === "manager")}
                  name="managerUserId"
                />
                <MemberSelect
                  label="Responsable de mission"
                  members={members}
                  name="leadUserId"
                />
              </div>
              <label className="check-field">
                <input defaultChecked name="initializeProgram" type="checkbox" />
                <span>
                  Initialiser un programme type de cycles, entièrement
                  modifiable ensuite.
                </span>
              </label>
              {error ? <p className="error-message">{error}</p> : null}
              <div className="modal-actions">
                <button
                  className="secondary-button"
                  onClick={() => setOpen(false)}
                  type="button"
                >
                  Annuler
                </button>
                <button className="primary-button" disabled={busy} type="submit">
                  {busy ? "Création…" : "Créer et ouvrir le programme"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </>
  );
}

function MemberSelect({
  label,
  members,
  name,
}: {
  label: string;
  members: MemberOption[];
  name: string;
}) {
  return (
    <label className="field-label">
      {label}
      <select className="text-field" name={name}>
        <option value="">Non assigné</option>
        {members.map((member) => (
          <option key={member.id} value={member.id}>
            {member.name}
          </option>
        ))}
      </select>
    </label>
  );
}
