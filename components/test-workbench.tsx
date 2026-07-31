"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Person, StatusPill } from "@/components/ui";
import type {
  ProgramTest,
  StatusDefinition,
} from "@/lib/server/queries";

type Cycle = { id: string; code: string; name: string; status: string };
type Member = {
  id: string;
  name: string;
  initials: string;
  role: string;
  isLead: number;
  canReview: number;
};

export function TestWorkbench({
  missionId,
  initialTests,
  cycles,
  members,
  statuses,
  actorUserId,
  canManage,
  initialSelectedId,
}: {
  missionId: string;
  initialTests: ProgramTest[];
  cycles: Cycle[];
  members: Member[];
  statuses: StatusDefinition[];
  actorUserId: string;
  canManage: boolean;
  initialSelectedId?: string;
}) {
  const router = useRouter();
  const [tests, setTests] = useState(initialTests);
  const [view, setView] = useState<"program" | "mine">("program");
  const [openCycles, setOpenCycles] = useState(
    () => new Set(cycles.map((cycle) => cycle.id)),
  );
  const [selectedId, setSelectedId] = useState(
    initialTests.some((test) => test.id === initialSelectedId)
      ? initialSelectedId!
      : initialTests[0]?.id ?? "",
  );
  const [dialog, setDialog] = useState<"test" | "cycle" | null>(null);
  const [defaultCycleId, setDefaultCycleId] = useState(cycles[0]?.id ?? "");
  const [busyId, setBusyId] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const selected = tests.find((test) => test.id === selectedId);
  const preparationStatuses = statuses.filter(
    (status) => status.stage === "preparation",
  );
  const reviewStatuses = statuses.filter(
    (status) => status.stage === "review",
  );

  const testsByCycle = useMemo(() => {
    const filtered =
      view === "mine"
        ? tests.filter(
            (test) =>
              test.assigneeId === actorUserId ||
              test.reviewerId === actorUserId,
          )
        : tests;
    return new Map(
      cycles.map((cycle) => [
        cycle.id,
        filtered.filter((test) => test.cycleId === cycle.id),
      ]),
    );
  }, [actorUserId, cycles, tests, view]);

  async function patchTest(id: string, patch: Partial<ProgramTest>) {
    setBusyId(id);
    setError("");
    const payload = {
      assignedToUserId: patch.assigneeId,
      reviewerUserId: patch.reviewerId,
      dueDate: patch.dueDate,
      conclusion: patch.conclusion,
      evidenceLink: patch.evidenceLink,
      comments: patch.comments,
      preparationStatus: patch.preparationStatus,
      reviewStatus: patch.reviewStatus,
    };
    const response = await fetch(`/api/tests/${id}`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(
        Object.fromEntries(
          Object.entries(payload).filter(([, value]) => value !== undefined),
        ),
      ),
    });
    const result = (await response.json()) as {
      error?: string;
      preparationStatus?: string;
      reviewStatus?: string;
    };
    if (!response.ok) {
      setError(result.error ?? "La modification n’a pas été enregistrée.");
      setBusyId("");
      return;
    }
    setTests((current) =>
      current.map((test) =>
        test.id === id
          ? {
              ...test,
              ...patch,
              preparationStatus:
                result.preparationStatus ??
                patch.preparationStatus ??
                test.preparationStatus,
              reviewStatus:
                result.reviewStatus ?? patch.reviewStatus ?? test.reviewStatus,
              assignee:
                patch.assigneeId !== undefined
                  ? members.find((member) => member.id === patch.assigneeId)
                      ?.name ?? "Non assigné"
                  : test.assignee,
              assigneeInitials:
                patch.assigneeId !== undefined
                  ? members.find((member) => member.id === patch.assigneeId)
                      ?.initials ?? "—"
                  : test.assigneeInitials,
              reviewer:
                patch.reviewerId !== undefined
                  ? members.find((member) => member.id === patch.reviewerId)
                      ?.name ?? "Non assigné"
                  : test.reviewer,
              reviewerInitials:
                patch.reviewerId !== undefined
                  ? members.find((member) => member.id === patch.reviewerId)
                      ?.initials ?? "—"
                  : test.reviewerInitials,
            }
          : test,
      ),
    );
    setMessage("Modification enregistrée et tracée.");
    setBusyId("");
  }

  async function createTest(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/missions/${missionId}/tests`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Le test n’a pas pu être créé.");
      return;
    }
    setDialog(null);
    router.refresh();
  }

  async function createCycle(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    const data = new FormData(event.currentTarget);
    const response = await fetch(`/api/missions/${missionId}/cycles`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(Object.fromEntries(data.entries())),
    });
    const result = (await response.json()) as { error?: string };
    if (!response.ok) {
      setError(result.error ?? "Le cycle n’a pas pu être créé.");
      return;
    }
    setDialog(null);
    router.refresh();
  }

  return (
    <div className="program-workspace">
      <section className="program-main">
        <div className="program-toolbar">
          <div className="segmented-control" aria-label="Vue du programme">
            <button
              className={view === "program" ? "is-active" : ""}
              onClick={() => setView("program")}
              type="button"
            >
              Programme complet
            </button>
            <button
              className={view === "mine" ? "is-active" : ""}
              onClick={() => setView("mine")}
              type="button"
            >
              Mes tests
            </button>
          </div>
          {canManage ? (
            <button
              className="secondary-button"
              onClick={() => setDialog("cycle")}
              type="button"
            >
              + Nouveau cycle
            </button>
          ) : null}
        </div>
        {message ? <p className="inline-notice">{message}</p> : null}
        {error ? <p className="error-message">{error}</p> : null}

        <div className="program-list">
          {cycles.map((cycle) => {
            const cycleTests = testsByCycle.get(cycle.id) ?? [];
            const expanded = openCycles.has(cycle.id);
            const completed = cycleTests.filter(
              (test) => test.preparationStatus === "completed",
            ).length;
            return (
              <section className="cycle-section" key={cycle.id}>
                <div className="cycle-header">
                  <button
                    aria-expanded={expanded}
                    className="cycle-toggle"
                    onClick={() =>
                      setOpenCycles((current) => {
                        const next = new Set(current);
                        if (next.has(cycle.id)) next.delete(cycle.id);
                        else next.add(cycle.id);
                        return next;
                      })
                    }
                    type="button"
                  >
                    <span aria-hidden="true">{expanded ? "⌄" : "›"}</span>
                    <span className="cycle-code">{cycle.code}</span>
                    <strong>{cycle.name}</strong>
                    <small>
                      {completed}/{cycleTests.length} réalisés
                    </small>
                  </button>
                  {canManage ? (
                    <button
                      className="cycle-add-test"
                      onClick={() => {
                        setDefaultCycleId(cycle.id);
                        setDialog("test");
                      }}
                      type="button"
                    >
                      + Ajouter un test
                    </button>
                  ) : null}
                </div>
                {expanded ? (
                  cycleTests.length ? (
                    <div className="program-table-wrap">
                      <table className="program-table">
                        <thead>
                          <tr>
                            <th>Test</th>
                            <th>Préparateur</th>
                            <th>Avancement</th>
                            <th>Relecteur</th>
                            <th>Revue</th>
                            <th>Échéance</th>
                          </tr>
                        </thead>
                        <tbody>
                          {cycleTests.map((test) => (
                            <tr
                              className={
                                selectedId === test.id ? "is-selected" : ""
                              }
                              key={test.id}
                              onClick={() => setSelectedId(test.id)}
                            >
                              <td>
                                <span className="test-code">{test.code}</span>
                                <span className="primary-cell">{test.title}</span>
                              </td>
                              <td>
                                {canManage ? (
                                  <select
                                    aria-label={`Préparateur de ${test.title}`}
                                    className="inline-select"
                                    disabled={busyId === test.id}
                                    onChange={(event) =>
                                      patchTest(test.id, {
                                        assigneeId: event.target.value,
                                      })
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    value={test.assigneeId}
                                  >
                                    <option value="">Non assigné</option>
                                    {members.map((member) => (
                                      <option key={member.id} value={member.id}>
                                        {member.name}
                                      </option>
                                    ))}
                                  </select>
                                ) : (
                                  <Person
                                    initials={test.assigneeInitials}
                                    name={test.assignee}
                                  />
                                )}
                              </td>
                              <td>
                                <StatusSelect
                                  disabled={
                                    busyId === test.id ||
                                    (!canManage &&
                                      test.assigneeId !== actorUserId)
                                  }
                                  onChange={(value) =>
                                    patchTest(test.id, {
                                      preparationStatus: value,
                                    })
                                  }
                                  options={preparationStatuses.filter(
                                    (status) =>
                                      status.code !== "completed" ||
                                      test.preparationStatus === "completed",
                                  )}
                                  value={test.preparationStatus}
                                />
                              </td>
                              <td>
                                {canManage ? (
                                  <select
                                    aria-label={`Relecteur de ${test.title}`}
                                    className="inline-select"
                                    disabled={busyId === test.id}
                                    onChange={(event) =>
                                      patchTest(test.id, {
                                        reviewerId: event.target.value,
                                      })
                                    }
                                    onClick={(event) => event.stopPropagation()}
                                    value={test.reviewerId}
                                  >
                                    <option value="">Non assigné</option>
                                    {members
                                      .filter(
                                        (member) =>
                                          member.id !== test.assigneeId &&
                                          (member.canReview ||
                                            ["partner", "manager", "senior"].includes(
                                              member.role,
                                            )),
                                      )
                                      .map((member) => (
                                        <option key={member.id} value={member.id}>
                                          {member.name}
                                        </option>
                                      ))}
                                  </select>
                                ) : (
                                  <Person
                                    initials={test.reviewerInitials}
                                    name={test.reviewer}
                                  />
                                )}
                              </td>
                              <td>
                                <StatusSelect
                                  disabled={
                                    busyId === test.id ||
                                    (!canManage &&
                                      test.reviewerId !== actorUserId)
                                  }
                                  onChange={(value) =>
                                    patchTest(test.id, { reviewStatus: value })
                                  }
                                  options={reviewStatuses}
                                  value={test.reviewStatus}
                                />
                              </td>
                              <td>
                                <input
                                  aria-label={`Échéance de ${test.title}`}
                                  className="inline-date"
                                  disabled={!canManage || busyId === test.id}
                                  onBlur={(event) =>
                                    patchTest(test.id, {
                                      dueDate: event.target.value,
                                    })
                                  }
                                  onClick={(event) => event.stopPropagation()}
                                  type="date"
                                  defaultValue={test.dueDate}
                                />
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="cycle-empty">
                      Aucun test dans ce cycle.
                      {canManage ? " Ajoutez le premier test." : ""}
                    </div>
                  )
                ) : null}
              </section>
            );
          })}
          {!cycles.length ? (
            <div className="empty-state">
              <strong>Programme de travail à construire</strong>
              <p>
                Créez les cycles adaptés à cette mission, puis ajoutez les
                tests à assigner.
              </p>
            </div>
          ) : null}
        </div>
      </section>

      {selected ? (
        <aside className="program-detail">
          <div className="detail-heading">
            <div>
              <span className="test-code">{selected.code}</span>
              <h3>{selected.title}</h3>
            </div>
            <StatusPill
              tone={
                statuses.find(
                  (status) =>
                    status.stage === "preparation" &&
                    status.code === selected.preparationStatus,
                )?.color ?? "neutral"
              }
            >
              {statuses.find(
                (status) =>
                  status.stage === "preparation" &&
                  status.code === selected.preparationStatus,
              )?.label ?? selected.preparationStatus}
            </StatusPill>
          </div>
          <div className="detail-section">
            <span className="micro-label">Objectif</span>
            <p>{selected.objective || "À préciser par le responsable."}</p>
          </div>
          <div className="detail-section">
            <span className="micro-label">Travail à réaliser</span>
            <p>{selected.instructions || "Consignes à compléter."}</p>
          </div>
          <label className="field-label">
            Lien vers la preuve
            <input
              className="text-field"
              defaultValue={selected.evidenceLink}
              onBlur={(event) =>
                patchTest(selected.id, { evidenceLink: event.target.value })
              }
              placeholder="Dossier d’audit, SharePoint, Drive…"
              type="url"
            />
          </label>
          <label className="field-label">
            Conclusion du préparateur
            <textarea
              className="text-field detail-textarea"
              defaultValue={selected.conclusion}
              onBlur={(event) =>
                patchTest(selected.id, { conclusion: event.target.value })
              }
            />
          </label>
          <label className="field-label">
            Commentaire de revue
            <textarea
              className="text-field detail-textarea"
              defaultValue={selected.comments}
              onBlur={(event) =>
                patchTest(selected.id, { comments: event.target.value })
              }
            />
          </label>
          <p className="segregation-note">
            L’affectation, chaque changement de statut et la revue sont
            horodatés. Le préparateur ne peut pas valider sa propre revue.
          </p>
        </aside>
      ) : null}

      {dialog === "test" ? (
        <TestDialog
          cycles={cycles}
          defaultCycleId={defaultCycleId}
          members={members}
          onClose={() => setDialog(null)}
          onSubmit={createTest}
        />
      ) : null}
      {dialog === "cycle" ? (
        <SimpleDialog
          eyebrow="Programme de travail"
          title="Créer un cycle"
          onClose={() => setDialog(null)}
        >
          <form className="member-form" onSubmit={createCycle}>
            <div className="form-grid">
              <label className="field-label">
                Code
                <input className="text-field" name="code" required />
              </label>
              <label className="field-label">
                Nom du cycle
                <input className="text-field" name="name" required />
              </label>
            </div>
            {error ? <p className="error-message">{error}</p> : null}
            <div className="modal-actions">
              <button
                className="secondary-button"
                onClick={() => setDialog(null)}
                type="button"
              >
                Annuler
              </button>
              <button className="primary-button" type="submit">
                Créer le cycle
              </button>
            </div>
          </form>
        </SimpleDialog>
      ) : null}
    </div>
  );
}

function StatusSelect({
  value,
  options,
  disabled,
  onChange,
}: {
  value: string;
  options: StatusDefinition[];
  disabled: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <select
      className={`status-select status-${options.find((item) => item.code === value)?.color ?? "neutral"}`}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      onClick={(event) => event.stopPropagation()}
      value={value}
    >
      {options.map((status) => (
        <option key={status.id} value={status.code}>
          {status.label}
        </option>
      ))}
    </select>
  );
}

function SimpleDialog({
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
      <section
        aria-modal="true"
        className="modal-card modal-card-wide"
        role="dialog"
      >
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

function TestDialog({
  cycles,
  members,
  defaultCycleId,
  onClose,
  onSubmit,
}: {
  cycles: Cycle[];
  members: Member[];
  defaultCycleId: string;
  onClose: () => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
}) {
  return (
    <SimpleDialog
      eyebrow="Programme collaboratif"
      title="Ajouter un test d’audit"
      onClose={onClose}
    >
      <form className="member-form" onSubmit={onSubmit}>
        <div className="form-grid">
          <label className="field-label">
            Cycle
            <select
              className="text-field"
              defaultValue={defaultCycleId}
              name="cycleId"
            >
              {cycles.map((cycle) => (
                <option key={cycle.id} value={cycle.id}>
                  {cycle.code} — {cycle.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Code du test
            <input
              className="text-field"
              name="code"
              placeholder="REV-01"
              required
            />
          </label>
        </div>
        <label className="field-label">
          Intitulé du test
          <input className="text-field" name="title" required />
        </label>
        <label className="field-label">
          Objectif d’audit
          <input className="text-field" name="objective" />
        </label>
        <label className="field-label">
          Travail à réaliser
          <textarea className="text-field detail-textarea" name="instructions" />
        </label>
        <div className="form-grid form-grid-three">
          <label className="field-label">
            Préparateur
            <select className="text-field" name="assignedToUserId">
              <option value="">Non assigné</option>
              {members.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field-label">
            Relecteur
            <select className="text-field" name="reviewerUserId">
              <option value="">Non assigné</option>
              {members
                .filter(
                  (member) =>
                    member.canReview ||
                    ["partner", "manager", "senior"].includes(member.role),
                )
                .map((member) => (
                  <option key={member.id} value={member.id}>
                    {member.name}
                  </option>
                ))}
            </select>
          </label>
          <label className="field-label">
            Échéance
            <input className="text-field" name="dueDate" type="date" />
          </label>
        </div>
        <div className="modal-actions">
          <button className="secondary-button" onClick={onClose} type="button">
            Annuler
          </button>
          <button className="primary-button" type="submit">
            Créer et assigner
          </button>
        </div>
      </form>
    </SimpleDialog>
  );
}
