"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { formatDate } from "@/lib/format";
import { REVIEW_STATUSES, STATUS_LABELS, type ReviewStatus, type Submission } from "@/lib/types";

const STORAGE_KEY = "miguel-cpp-lab:professor-key";

export default function ProfessorPage() {
  const [key, setKey] = useState<string | null>(null);
  const [keyInput, setKeyInput] = useState("");
  const [checking, setChecking] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(STORAGE_KEY);
      if (stored) setKey(stored);
    } catch {
      // sessionStorage puede estar bloqueado: se pide la clave otra vez.
    }
    setReady(true);
  }, []);

  async function handleLogin(event: React.FormEvent) {
    event.preventDefault();
    setChecking(true);
    setGateError(null);
    try {
      const response = await fetch("/api/professor/session", {
        method: "POST",
        headers: { Authorization: `Bearer ${keyInput.trim()}` },
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data?.error ?? "No se pudo validar la clave.");
      try {
        window.sessionStorage.setItem(STORAGE_KEY, keyInput.trim());
      } catch {
        // sin sessionStorage la sesión dura lo que dure la pestaña
      }
      setKey(keyInput.trim());
      setKeyInput("");
    } catch (error) {
      setGateError(error instanceof Error ? error.message : "No se pudo validar la clave.");
    } finally {
      setChecking(false);
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

  if (!ready) return null;

  if (!key) {
    return (
      <div className="shell">
        <header className="topbar">
          <div className="brand">
            <span>
              Miguel <span className="dot">C++</span> Lab
            </span>
            <small>revisión</small>
          </div>
          <nav>
            <Link href="/">/ alumno</Link>
          </nav>
        </header>
        <div className="gate">
          <h1>Acceso del profesor</h1>
          <p>
            Introduce la clave de revisión. Se guarda sólo en esta pestaña y se envía como
            <code> Authorization: Bearer</code> a la API.
          </p>
          <form onSubmit={handleLogin}>
            <label className="field">
              <span>Clave</span>
              <input
                type="password"
                value={keyInput}
                autoFocus
                autoComplete="current-password"
                onChange={(event) => setKeyInput(event.target.value)}
              />
            </label>
            <button type="submit" className="primary" disabled={checking || !keyInput.trim()}>
              {checking ? "Comprobando…" : "Entrar"}
            </button>
          </form>
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

function ReviewBoard({
  professorKey,
  onSignOut,
}: {
  professorKey: string;
  onSignOut: () => void;
}) {
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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

  function replace(updated: Submission) {
    setSubmissions((current) =>
      current.map((item) => (item.id === updated.id ? updated : item)),
    );
  }

  const pending = submissions.filter((item) => item.reviewStatus === "pendiente").length;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>revisión del profesor</small>
        </div>
        <nav>
          <span className="filename">
            {submissions.length} entregas · {pending} pendientes
          </span>
          <Link href="/">/ alumno</Link>
          <button type="button" className="ghost" onClick={onSignOut}>
            Salir
          </button>
        </nav>
      </header>

      <main className="layout" style={{ gridTemplateColumns: "minmax(0, 1fr)" }}>
        <div className="column">
          <div className="toolbar panel">
            <button type="button" onClick={() => void load()} disabled={loading}>
              {loading ? "Cargando…" : "Actualizar"}
            </button>
            <span className="spacer" />
            {error && <span className="notice error">{error}</span>}
          </div>

          {loading && submissions.length === 0 ? (
            <p className="empty">Cargando entregas…</p>
          ) : submissions.length === 0 ? (
            <p className="empty">Todavía no hay entregas.</p>
          ) : (
            submissions.map((submission) => (
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
  const [saving, setSaving] = useState(false);
  const [result, setResult] = useState<{ kind: "error" | "success"; text: string } | null>(null);

  useEffect(() => {
    setStatus(submission.reviewStatus);
    setFeedback(submission.feedback);
  }, [submission]);

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
        body: JSON.stringify({ status, feedback }),
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
        <span>{submission.title}</span>
        <span className={`badge ${submission.reviewStatus}`}>
          {STATUS_LABELS[submission.reviewStatus]}
        </span>
      </div>
      <div className="panel-body">
        <div className="meta-row" style={{ marginBottom: 12 }}>
          <span>Entregada: {formatDate(submission.createdAt)}</span>
          <span>Revisada: {formatDate(submission.reviewedAt)}</span>
          <span>id: {submission.id}</span>
        </div>

        <div className="review-grid">
          <div>
            <div className="block-label">Código</div>
            <pre className="code-block">{submission.code}</pre>

            {submission.stdin && (
              <>
                <div className="block-label" style={{ marginTop: 12 }}>
                  Entrada (stdin)
                </div>
                <pre className="code-block">{submission.stdin}</pre>
              </>
            )}

            {submission.compilerOutput && (
              <>
                <div className="block-label" style={{ marginTop: 12 }}>
                  Resultado de compilación
                </div>
                <pre className="code-block">{submission.compilerOutput}</pre>
              </>
            )}
          </div>

          <div className="review-controls">
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
              <span>Feedback</span>
              <textarea
                rows={8}
                value={feedback}
                onChange={(event) => setFeedback(event.target.value)}
                placeholder="Comentarios para el alumno"
              />
            </label>
            <button type="button" className="primary" onClick={save} disabled={saving}>
              {saving ? "Guardando…" : "Guardar revisión"}
            </button>
            {result && <span className={`notice ${result.kind}`}>{result.text}</span>}
          </div>
        </div>
      </div>
    </section>
  );
}
