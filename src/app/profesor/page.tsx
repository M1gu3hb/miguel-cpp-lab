"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { REVIEW_STATUSES, STATUS_LABELS, type ReviewStatus, type Submission } from "@/lib/types";

const STORAGE_KEY = "miguel-cpp-lab:professor-key";

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
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span>
              Miguel <span className="dot">C++</span> Lab
            </span>
            <small>profesor</small>
          </div>
          <nav>
            <Link href="/">/ alumno</Link>
          </nav>
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
              <button type="submit" className="primary" disabled={busy || keyInput.trim().length < 8}>
                {busy ? "Comprobando…" : firstTime ? "Guardar contraseña" : "Entrar"}
              </button>
              {firstTime && <p className="hint">Mínimo 8 caracteres.</p>}
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

type Filter = "todas" | "pendiente" | "revisadas";

function ReviewBoard({ professorKey, onSignOut }: { professorKey: string; onSignOut: () => void }) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>("todas");
  const [query, setQuery] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/submissions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudieron cargar las entregas.");
      setSubmissions(data.items ?? []);
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
          : filter === "pendiente"
            ? item.reviewStatus === "pendiente"
            : item.reviewStatus !== "pendiente";
      const byQuery =
        !needle ||
        item.title.toLowerCase().includes(needle) ||
        item.code.toLowerCase().includes(needle);
      return byFilter && byQuery;
    });
  }, [submissions, filter, query]);

  function replace(updated: Submission) {
    setSubmissions((current) => current.map((item) => (item.id === updated.id ? updated : item)));
  }

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>profesor</small>
        </div>
        <nav>
          <span className="filename">
            {submissions.length} entregas · {pending} sin revisar
          </span>
          <Link href="/">/ alumno</Link>
          <button type="button" className="ghost" onClick={onSignOut}>
            Salir
          </button>
        </nav>
      </header>

      <main className="layout single">
        <div className="column">
          <div className="panel toolbar">
            <div className="segmented">
              {(["todas", "pendiente", "revisadas"] as Filter[]).map((value) => (
                <button
                  key={value}
                  type="button"
                  className={filter === value ? "active" : ""}
                  onClick={() => setFilter(value)}
                >
                  {value === "todas"
                    ? "Todas"
                    : value === "pendiente"
                      ? `Sin revisar (${pending})`
                      : "Revisadas"}
                </button>
              ))}
            </div>
            <input
              type="text"
              className="search"
              placeholder="Buscar por nombre o código…"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <span className="grow" />
            <button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? "Cargando…" : "Actualizar"}
            </button>
            {error && <span className="notice error">{error}</span>}
          </div>

          {loading && submissions.length === 0 ? (
            <p className="empty">Cargando entregas…</p>
          ) : visible.length === 0 ? (
            <p className="empty">No hay entregas que mostrar.</p>
          ) : (
            visible.map((submission) => (
              <ReviewCard
                key={submission.id}
                submission={submission}
                professorKey={professorKey}
                onUpdated={replace}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function ReviewCard({
  submission,
  professorKey,
  onUpdated,
}: {
  submission: Submission;
  professorKey: string;
  onUpdated: (submission: Submission) => void;
}) {
  const [status, setStatus] = useState<ReviewStatus>(submission.reviewStatus);
  const [feedback, setFeedback] = useState(submission.feedback);
  const [title, setTitle] = useState(submission.title);
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setStatus(submission.reviewStatus);
    setFeedback(submission.feedback);
    setTitle(submission.title);
  }, [submission]);

  const dirty =
    status !== submission.reviewStatus ||
    feedback !== submission.feedback ||
    title.trim() !== submission.title;

  async function save() {
    setSaving(true);
    setResult(null);
    try {
      const response = await fetch(`/api/submissions/${submission.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${professorKey}`,
        },
        body: JSON.stringify({ status, feedback, title: title.trim() }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar la revisión.");
      onUpdated(data.submission);
      setResult({ kind: "success", text: "Revisión guardada." });
    } catch (error) {
      setResult({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la revisión.",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="panel">
      <div className="panel-head">
        <span className="tab">{submission.title}</span>
        <span className="grow" />
        <span className="muted-chip">{formatDate(submission.createdAt)}</span>
        <span className={`badge ${submission.reviewStatus}`}>
          {STATUS_LABELS[submission.reviewStatus]}
        </span>
      </div>
      <div className="panel-body">
        <div className="review-grid">
          <div>
            <div className="block-label">Código entregado</div>
            <pre className="code-block tall">{submission.code}</pre>

            <div className="two-up">
              <div>
                <div className="block-label">Entrada (stdin)</div>
                <pre className="code-block">{submission.stdin || "(vacía)"}</pre>
              </div>
              <div>
                <div className="block-label">Compilación y ejecución</div>
                <pre className="code-block">
                  {submission.compilerOutput || "(el alumno no ejecutó antes de entregar)"}
                </pre>
              </div>
            </div>
          </div>

          <div className="review-controls">
            <label className="field">
              <span>Nombre del ejercicio</span>
              <input
                type="text"
                value={title}
                maxLength={200}
                onChange={(event) => setTitle(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Estado</span>
              <select
                value={status}
                onChange={(event) => setStatus(event.target.value as ReviewStatus)}
              >
                {REVIEW_STATUSES.map((value) => (
                  <option key={value} value={value}>
                    {STATUS_LABELS[value]}
                  </option>
                ))}
              </select>
            </label>
            <label className="field">
              <span>Notas para el alumno</span>
              <textarea
                rows={10}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Qué está bien, qué hay que corregir y por qué."
              />
            </label>
            <button type="button" className="primary" onClick={save} disabled={saving || !dirty}>
              {saving ? "Guardando…" : dirty ? "Guardar revisión" : "Sin cambios"}
            </button>
            <div className="meta-row">
              <span>Revisada: {formatDate(submission.reviewedAt)}</span>
              <span>id: {submission.id}</span>
            </div>
            {result && <span className={`notice ${result.kind}`}>{result.text}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
