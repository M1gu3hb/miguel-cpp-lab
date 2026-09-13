"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { highlightCpp } from "@/lib/cpp-highlight";
import {
  NOTE_KINDS,
  NOTE_LABELS,
  REVIEW_STATUSES,
  STATUS_LABELS,
  type NoteKind,
  type ReviewNote,
  type ReviewStatus,
  type Submission,
} from "@/lib/types";
import type { RunResult } from "@/lib/run-cpp";

const STORAGE_KEY = "miguel-cpp-lab:professor-key";
const DRAFT_PREFIX = "cpp-lab:review:";

type Status = { bound: boolean; setupOpen: boolean };

export default function ProfessorPage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [confirmInput, setConfirmInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [status, setStatus] = useState<Status | null>(null);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) setKey(stored);
    } catch {
      // sessionStorage puede estar bloqueado: se pide la clave otra vez.
    }
    fetch("/api/professor/status", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setStatus({ bound: Boolean(data.bound), setupOpen: Boolean(data.setupOpen) }))
      .catch(() => setStatus({ bound: true, setupOpen: false }));
  }, []);

  function remember(value: string) {
    try {
      window.sessionStorage.setItem(STORAGE_KEY, value);
    } catch {
      // sin sessionStorage la sesión dura lo que dure la pestaña
    }
    setKey(value);
    setKeyInput("");
    setConfirmInput("");
  }

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setBusy(true);
    setGateError(null);
    try {
      const response = await fetch("/api/professor/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${keyInput.trim()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "No se pudo validar la clave.");
      remember(keyInput.trim());
    } catch (error) {
      setGateError(error instanceof Error ? error.message : "No se pudo validar la clave.");
    } finally {
      setBusy(false);
    }
  }

  async function handleSetup(event: React.FormEvent) {
    event.preventDefault();
    if (keyInput.trim() !== confirmInput.trim()) {
      setGateError("Las dos contraseñas no coinciden.");
      return;
    }
    setBusy(true);
    setGateError(null);
    try {
      const response = await fetch("/api/professor/setup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ key: keyInput.trim() }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "No se pudo dar de alta la clave.");
      setStatus({ bound: true, setupOpen: false });
      remember(keyInput.trim());
    } catch (error) {
      setGateError(error instanceof Error ? error.message : "No se pudo dar de alta la clave.");
    } finally {
      setBusy(false);
    }
  }

  function signOut() {
    try {
      window.sessionStorage.removeItem(STORAGE_KEY);
    } catch {
      // nada que limpiar
    }
    setKey(null);
  }

  if (!status) return null;

  if (!key) {
    const firstTime = !status.bound && status.setupOpen;
    const blocked = !status.bound && !status.setupOpen;

    return (
      <div className="prof">
        <header className="titlebar">
          <div className="brand">
            <span>
              Miguel <span className="dot">C++</span> Lab
            </span>
            <small>profesor</small>
          </div>
          <div className="titlebar-actions">
            <Link href="/" className="link-plain">
              / alumno
            </Link>
          </div>
        </header>

        <div className="gate">
          <h1>{firstTime ? "Define tu contraseña" : "Acceso del profesor"}</h1>
          <p>
            {firstTime
              ? "Es la primera vez que se entra. Elige la contraseña con la que revisarás las entregas: se guarda cifrada (bcrypt) en la base de datos, nunca en el código."
              : blocked
                ? "Todavía no hay contraseña dada de alta y el alta está cerrada. Ábrela desde la consola de Supabase ejecutando select cpp_lab_open_setup_window(30); y recarga esta página."
                : "Introduce tu contraseña. Se guarda sólo en esta pestaña y viaja como Authorization: Bearer hacia la API."}
          </p>

          {!blocked && (
            <form onSubmit={firstTime ? handleSetup : handleLogin}>
              <label className="field">
                <span>{firstTime ? "Contraseña nueva" : "Contraseña"}</span>
                <input
                  type="password"
                  value={keyInput}
                  autoFocus
                  autoComplete={firstTime ? "new-password" : "current-password"}
                  onChange={(event) => setKeyInput(event.target.value)}
                />
              </label>
              {firstTime && (
                <label className="field">
                  <span>Repite la contraseña</span>
                  <input
                    type="password"
                    value={confirmInput}
                    autoComplete="new-password"
                    onChange={(event) => setConfirmInput(event.target.value)}
                  />
                </label>
              )}
              <button type="submit" className="primary" disabled={busy || keyInput.trim().length < 10}>
                {busy ? "Comprobando…" : firstTime ? "Guardar contraseña" : "Entrar"}
              </button>
              {firstTime && <p className="hint">Mínimo 10 caracteres.</p>}
            </form>
          )}

          {gateError && (
            <p className="notice error" style={{ marginTop: 14 }}>
              {gateError}
            </p>
          )}
        </div>
      </div>
    );
  }

  return <ReviewBoard professorKey={key} onSignOut={signOut} />;
}

type Filter = "pendientes" | "todas" | "revisadas";

function ReviewBoard({ professorKey, onSignOut }: { professorKey: string; onSignOut: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("pendientes");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/submissions", { cache: "no-store" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error ?? `El servidor respondió ${response.status}.`);
      }
      const data = await response.json();
      const items: Submission[] = data.items ?? [];
      setSubmissions(items);
      setSelectedId((current) => current ?? items[0]?.id ?? null);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudieron cargar las entregas.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const pending = submissions.filter((item) => item.reviewStatus === "pendiente").length;

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return submissions.filter((item) => {
      const byFilter =
        filter === "todas"
          ? true
          : filter === "pendientes"
            ? item.reviewStatus === "pendiente"
            : item.reviewStatus !== "pendiente";
      const byQuery =
        !needle ||
        item.title.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle);
      return byFilter && byQuery;
    });
  }, [submissions, filter, query]);

  const selected = submissions.find((item) => item.id === selectedId) ?? visible[0] ?? null;

  function replace(updated: Submission) {
    setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  function next() {
    const index = visible.findIndex((item) => item.id === selected?.id);
    const candidate = visible[index + 1] ?? visible[0];
    if (candidate) setSelectedId(candidate.id);
  }

  return (
    <div className="prof">
      <header className="titlebar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>profesor</small>
        </div>
        <div className="titlebar-actions">
          <span className="muted-chip">
            {submissions.length} entregas · {pending} sin revisar
          </span>
          <button type="button" onClick={() => void load()} disabled={loading}>
            {loading ? "Cargando…" : "Actualizar"}
          </button>
          <Link href="/" className="link-plain">
            / alumno
          </Link>
          <button type="button" className="ghost" onClick={onSignOut}>
            Salir
          </button>
        </div>
      </header>

      <div className="prof-body">
        <aside className="queue">
          <div className="queue-tools">
            <div className="segmented">
              {(["pendientes", "todas", "revisadas"] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {value === "pendientes" ? `Sin revisar (${pending})` : value === "todas" ? "Todas" : "Revisadas"}
                </button>
              ))}
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre o código…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            {error && <span className="notice error">{error}</span>}
          </div>

          <div className="queue-list">
            {visible.length === 0 ? (
              <p className="empty">No hay entregas que mostrar.</p>
            ) : (
              visible.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  className={`queue-item ${item.id === selected?.id ? "active" : ""}`}
                  onClick={() => setSelectedId(item.id)}
                >
                  <span className="submission-main">
                    <span className="submission-title">{item.title}</span>
                    <span className="submission-date">{formatDate(item.createdAt)}</span>
                  </span>
                  <span className={`badge ${item.reviewStatus}`}>{STATUS_LABELS[item.reviewStatus]}</span>
                </button>
              ))
            )}
          </div>
        </aside>

        {selected ? (
          <ReviewDetail
            key={selected.id}
            submission={selected}
            professorKey={professorKey}
            onUpdated={replace}
            onNext={next}
          />
        ) : (
          <div className="detail">
            <p className="empty">{loading ? "Cargando entregas…" : "Elige una entrega de la lista."}</p>
          </div>
        )}
      </div>
    </div>
  );
}

type Draft = {
  status: ReviewStatus;
  feedback: string;
  title: string;
  notes: ReviewNote[];
};

function ReviewDetail({
  submission,
  professorKey,
  onUpdated,
  onNext,
}: {
  submission: Submission;
  professorKey: string;
  onUpdated: (submission: Submission) => void;
  onNext: () => void;
}) {
  const [draft, setDraft] = useState<Draft>(() => ({
    status: submission.reviewStatus,
    feedback: submission.feedback,
    title: submission.title,
    notes: submission.reviewNotes,
  }));
  const [editingLine, setEditingLine] = useState<number | null>(null);
  // Un borrador por línea: pulsar otra línea no tira lo que se estaba escribiendo.
  const [lineDrafts, setLineDrafts] = useState<Record<number, { text: string; kind: NoteKind }>>({});
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  const [runStdin, setRunStdin] = useState(submission.stdin);
  const [run, setRun] = useState<(RunResult & { console: string }) | null>(null);
  const [running, setRunning] = useState(false);

  const lines = useMemo(() => submission.code.split("\n"), [submission.code]);
  const storageKey = `${DRAFT_PREFIX}${submission.id}`;

  // Hay cambios sin publicar: gobierna el borrador local y el aviso de la ficha.
  const dirty =
    draft.status !== submission.reviewStatus ||
    draft.feedback !== submission.feedback ||
    draft.title.trim() !== submission.title ||
    JSON.stringify(draft.notes.map((n) => [n.line, n.kind, n.body])) !==
      JSON.stringify(submission.reviewNotes.map((n) => [n.line, n.kind, n.body]));

  // Borrador local: la revisión a medias no se pierde al recargar, pero tampoco
  // se publica sola.
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) return;
      const stored = JSON.parse(raw) as { savedAt?: string; draft?: Draft };
      const savedAt = stored?.savedAt ? Date.parse(stored.savedAt) : 0;
      const reviewedAt = submission.reviewedAt ? Date.parse(submission.reviewedAt) : 0;
      // Si se publicó una revisión después de guardar el borrador, manda lo publicado.
      const saved = stored?.draft;
      if (!saved || (reviewedAt && savedAt && reviewedAt > savedAt)) {
        window.localStorage.removeItem(storageKey);
        return;
      }
      setDraft((current) => ({ ...current, ...saved, notes: saved.notes ?? current.notes }));
    } catch {
      // el borrador local es una comodidad
    }
  }, [storageKey, submission.reviewedAt]);

  useEffect(() => {
    if (!dirty) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(
          storageKey,
          JSON.stringify({ savedAt: new Date().toISOString(), draft }),
        );
      } catch {
        // idem
      }
    }, 300);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draft, storageKey]);

  const notesByLine = useMemo(() => {
    const map = new Map<number, ReviewNote[]>();
    for (const note of draft.notes) {
      const list = map.get(note.line) ?? [];
      list.push(note);
      map.set(note.line, list);
    }
    return map;
  }, [draft.notes]);

  function openEditor(line: number) {
    setEditingLine((current) => (current === line ? null : line));
    setLineDrafts((current) => (current[line] ? current : { ...current, [line]: { text: "", kind: "error" } }));
  }

  function updateLineDraft(line: number, patch: Partial<{ text: string; kind: NoteKind }>) {
    setLineDrafts((current) => ({
      ...current,
      [line]: { text: current[line]?.text ?? "", kind: current[line]?.kind ?? "error", ...patch },
    }));
  }

  function addNote(line: number) {
    const body = (lineDrafts[line]?.text ?? "").trim();
    if (!body) return;
    const note: ReviewNote = {
      id: `n_${Math.random().toString(36).slice(2, 10)}`,
      line,
      kind: lineDrafts[line]?.kind ?? "error",
      body,
      createdAt: new Date().toISOString(),
    };
    setDraft((current) => ({ ...current, notes: [...current.notes, note].sort((a, b) => a.line - b.line) }));
    setEditingLine(null);
    setLineDrafts((current) => {
      const next = { ...current };
      delete next[line];
      return next;
    });
  }

  function removeNote(id: string) {
    setDraft((current) => ({ ...current, notes: current.notes.filter((note) => note.id !== id) }));
  }

  async function publish(andNext = false) {
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/review`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${professorKey}` },
        body: JSON.stringify({
          status: draft.status,
          feedback: draft.feedback,
          title: draft.title.trim(),
          notes: draft.notes.map(({ id, line, kind, body, createdAt }) => ({
            id,
            line,
            kind,
            body,
            createdAt,
          })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? `El servidor respondió ${response.status}.`);
      onUpdated(data.submission);
      try {
        window.localStorage.removeItem(storageKey);
      } catch {
        // nada que limpiar
      }
      setResult({ kind: "success", text: "Revisión publicada." });
      if (andNext) onNext();
    } catch (error) {
      setResult({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la revisión.",
      });
    } finally {
      setSaving(false);
    }
  }

  async function runStudentCode() {
    setRunning(true);
    setRun(null);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: submission.code, stdin: runStdin, mode: "batch" }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo ejecutar.");
      setRun(data);
    } catch (error) {
      setResult({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo ejecutar el código.",
      });
    } finally {
      setRunning(false);
    }
  }

  return (
    <div className="detail">
      <div className="detail-head">
        <h1 style={{ fontSize: 16, margin: 0 }}>{submission.title}</h1>
        <span className={`badge ${submission.reviewStatus}`}>{STATUS_LABELS[submission.reviewStatus]}</span>
        <span className="muted-chip">{formatDate(submission.createdAt)}</span>
        <span className="grow" />
        <span className="muted-chip">{lines.length} líneas</span>
        <span className="muted-chip">{draft.notes.length} notas</span>
      </div>

      <div className="detail-grid">
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <section className="card">
            <div className="card-head">
              <span>main.cpp</span>
              <span className="grow" />
              <span>haz clic en una línea para dejar una nota</span>
            </div>
            <div className="code-review">
              {lines.map((text, index) => {
                const number = index + 1;
                const notes = notesByLine.get(number) ?? [];
                return (
                  <div key={number}>
                    <button
                      type="button"
                      className={`code-line ${notes.length ? "has-note" : ""}`}
                      onClick={() => openEditor(number)}
                      aria-expanded={editingLine === number}
                      aria-label={`Línea ${number}: ${text || "(vacía)"}. Añadir nota.`}
                    >
                      <span className="ln">{number}</span>
                      <span className="add" aria-hidden>
                        +
                      </span>
                      <span className="src">{text ? highlightCpp(text, String(number)) : " "}</span>
                    </button>

                    {notes.map((note) => (
                      <div key={note.id} className="line-note">
                        <span />
                        <div className="body">
                          <div className={`note ${note.kind}`}>
                            <span className="note-kind">{NOTE_LABELS[note.kind]}</span>
                            <p>{note.body}</p>
                          </div>
                          <div className="note-actions">
                            <button type="button" className="ghost" onClick={() => removeNote(note.id)}>
                              Borrar nota
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}

                    {editingLine === number && (
                      <div className="line-note">
                        <span />
                        <div className="body">
                          <div className="kind-picker">
                            {NOTE_KINDS.map((kind) => (
                              <button
                                key={kind}
                                type="button"
                                className={`${kind} ${(lineDrafts[number]?.kind ?? "error") === kind ? "active" : ""}`}
                                onClick={() => updateLineDraft(number, { kind })}
                              >
                                {NOTE_LABELS[kind]}
                              </button>
                            ))}
                          </div>
                          <textarea
                            autoFocus
                            value={lineDrafts[number]?.text ?? ""}
                            maxLength={2000}
                            placeholder={`Nota para la línea ${number}`}
                            onChange={(event) => updateLineDraft(number, { text: event.target.value })}
                            onKeyDown={(event) => {
                              if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) addNote(number);
                              if (event.key === "Escape") setEditingLine(null);
                            }}
                          />
                          <div className="note-actions">
                            <button
                              type="button"
                              className="primary"
                              onClick={() => addNote(number)}
                              disabled={!(lineDrafts[number]?.text ?? "").trim()}
                            >
                              Añadir nota
                            </button>
                            <button type="button" className="ghost" onClick={() => setEditingLine(null)}>
                              Cancelar
                            </button>
                            <span className="hint">Ctrl+Enter añade</span>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span>Compilación y ejecución guardadas por el alumno</span>
            </div>
            <div className="card-body">
              <pre className="code-block">
                {submission.compilerOutput || "(el alumno no ejecutó antes de entregar)"}
              </pre>
            </div>
          </section>

          <section className="card">
            <div className="card-head">
              <span>Ejecutar este código ahora</span>
              <span className="grow" />
              {run && <span className="muted-chip">{run.statusLabel}</span>}
            </div>
            <div className="card-body">
              <label className="field">
                <span>Entrada (stdin)</span>
                <textarea
                  rows={3}
                  value={runStdin}
                  spellCheck={false}
                  onChange={(event) => setRunStdin(event.target.value)}
                />
              </label>
              <div className="note-actions">
                <button type="button" onClick={() => void runStudentCode()} disabled={running}>
                  {running ? "Ejecutando…" : "Compilar y ejecutar"}
                </button>
                <button type="button" className="ghost" onClick={() => setRunStdin(submission.stdin)}>
                  Usar la entrada del alumno
                </button>
              </div>
              {run && <pre className="code-block" style={{ marginTop: 12 }}>{run.console}</pre>}
            </div>
          </section>
        </div>

        <div className="review-side">
          <section className="card">
            <div className="card-head">
              <span>Revisión</span>
              {dirty && <span className="muted-chip">sin publicar</span>}
            </div>
            <div className="card-body">
              <label className="field">
                <span>Nombre del ejercicio</span>
                <input
                  type="text"
                  value={draft.title}
                  maxLength={200}
                  onChange={(event) => setDraft((d) => ({ ...d, title: event.target.value }))}
                />
              </label>
              <label className="field">
                <span>Estado</span>
                <select
                  value={draft.status}
                  onChange={(event) => setDraft((d) => ({ ...d, status: event.target.value as ReviewStatus }))}
                >
                  {REVIEW_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {STATUS_LABELS[value]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="field">
                <span>Notas generales</span>
                <textarea
                  rows={8}
                  value={draft.feedback}
                  onChange={(event) => setDraft((d) => ({ ...d, feedback: event.target.value }))}
                  placeholder="Qué está bien, qué hay que corregir y por qué."
                />
              </label>
              <div className="note-actions">
                <button type="button" className="primary" onClick={() => void publish(false)} disabled={saving}>
                  {saving ? "Publicando…" : "Publicar revisión"}
                </button>
                <button type="button" onClick={() => void publish(true)} disabled={saving}>
                  Publicar y siguiente
                </button>
              </div>
              {result && (
                <span className={`notice ${result.kind}`} style={{ display: "block", marginTop: 10 }}>
                  {result.text}
                </span>
              )}
              <div className="meta-row" style={{ marginTop: 10 }}>
                <span>Revisada: {formatDate(submission.reviewedAt)}</span>
                <span>id: {submission.id}</span>
              </div>
            </div>
          </section>

          {draft.notes.length > 0 && (
            <section className="card">
              <div className="card-head">
                <span>Notas por línea</span>
                <span className="grow" />
                <span className="muted-chip">{draft.notes.length}</span>
              </div>
              <div className="card-body">
                <ul className="note-list">
                  {draft.notes.map((note) => (
                    <li key={note.id} className={`note ${note.kind}`}>
                      <span className="note-line">línea {note.line}</span>
                      <span className="note-kind">{NOTE_LABELS[note.kind]}</span>
                      <p>{note.body}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
