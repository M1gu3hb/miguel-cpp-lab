"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import CodeEditor from "@/components/CodeEditor";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, type Submission } from "@/lib/types";

const CONSOLE_PLACEHOLDER = "La consola aparecerá aquí.";

export default function StudentPage() {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(CONSOLE_PLACEHOLDER);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  const loadSubmissions = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/submissions", { cache: "no-store" });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudieron cargar las entregas.");
      setSubmissions(data.items ?? []);
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudieron cargar las entregas.",
      });
    } finally {
      setLoadingList(false);
    }
  }, []);

  useEffect(() => {
    void loadSubmissions();
  }, [loadSubmissions]);

  async function handleRun() {
    if (!code.trim()) {
      setOutput("No hay código para compilar.");
      return;
    }
    setRunning(true);
    setMessage(null);
    setOutput("Compilando…");
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo compilar.");
      setOutput(data.console || "El programa terminó sin salida.");
    } catch (error) {
      setOutput(
        error instanceof Error
          ? `No se pudo ejecutar el compilador: ${error.message}`
          : "No se pudo ejecutar el compilador.",
      );
    } finally {
      setRunning(false);
    }
  }

  async function handleSubmit() {
    if (!code.trim()) {
      setMessage({ kind: "error", text: "Escribe código antes de entregar." });
      return;
    }
    setSubmitting(true);
    setMessage(null);
    try {
      const response = await fetch("/api/submissions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          code,
          stdin,
          compilerOutput: output === CONSOLE_PLACEHOLDER ? "" : output,
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar la entrega.");
      setMessage({ kind: "success", text: "Entrega guardada." });
      await loadSubmissions();
    } catch (error) {
      setMessage({
        kind: "error",
        text: error instanceof Error ? error.message : "No se pudo guardar la entrega.",
      });
    } finally {
      setSubmitting(false);
    }
  }

  const busy = running || submitting;

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>laboratorio de código</small>
        </div>
        <nav>
          <span className="filename">main.cpp</span>
          <Link href="/profesor">/profesor</Link>
        </nav>
      </header>

      <main className="layout">
        <div className="column">
          <section className="panel">
            <div className="panel-head">
              <span>main.cpp</span>
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setCode("");
                  setOutput(CONSOLE_PLACEHOLDER);
                  setMessage(null);
                }}
                disabled={busy}
              >
                Limpiar
              </button>
            </div>
            <CodeEditor value={code} onChange={setCode} />
            <div className="actions">
              <button type="button" className="primary" onClick={handleRun} disabled={busy}>
                {running ? "Compilando…" : "Compilar y ejecutar"}
              </button>
              <button type="button" className="solid" onClick={handleSubmit} disabled={busy}>
                {submitting ? "Entregando…" : "Entregar"}
              </button>
              {message && <span className={`notice ${message.kind}`}>{message.text}</span>}
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span>Consola</span>
            </div>
            <pre className={`console${output === CONSOLE_PLACEHOLDER ? " muted" : ""}`}>
              {output}
            </pre>
          </section>
        </div>

        <div className="column">
          <section className="panel">
            <div className="panel-head">
              <span>Ejercicio</span>
            </div>
            <div className="panel-body">
              <label className="field">
                <span>Nombre del ejercicio</span>
                <input
                  type="text"
                  value={title}
                  maxLength={200}
                  placeholder="Ejercicio 1"
                  onChange={(event) => setTitle(event.target.value)}
                />
              </label>
              <label className="field">
                <span>Entrada (stdin)</span>
                <textarea
                  value={stdin}
                  rows={4}
                  placeholder="Lo que leerá std::cin"
                  onChange={(event) => setStdin(event.target.value)}
                />
              </label>
              <p className="hint">
                Una entrega enviada no se modifica. Si cambias el código, entrega otra vez.
              </p>
            </div>
          </section>

          <section className="panel">
            <div className="panel-head">
              <span>Mis entregas</span>
              <button type="button" className="ghost" onClick={() => void loadSubmissions()}>
                Actualizar
              </button>
            </div>
            {loadingList ? (
              <p className="empty">Cargando…</p>
            ) : submissions.length === 0 ? (
              <p className="empty">Todavía no hay entregas.</p>
            ) : (
              <div className="submissions">
                {submissions.map((submission) => (
                  <article key={submission.id} className="submission">
                    <div
                      className="submission-head"
                      onClick={() => setOpenId(openId === submission.id ? null : submission.id)}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div className="submission-title">{submission.title}</div>
                        <div className="submission-date">{formatDate(submission.createdAt)}</div>
                      </div>
                      <span className={`badge ${submission.reviewStatus}`}>
                        {STATUS_LABELS[submission.reviewStatus]}
                      </span>
                    </div>

                    {openId === submission.id && (
                      <div className="submission-body">
                        <div>
                          <div className="block-label">Código</div>
                          <pre className="code-block">{submission.code}</pre>
                        </div>
                        {submission.stdin && (
                          <div>
                            <div className="block-label">Entrada (stdin)</div>
                            <pre className="code-block">{submission.stdin}</pre>
                          </div>
                        )}
                        {submission.compilerOutput && (
                          <div>
                            <div className="block-label">Última salida del compilador</div>
                            <pre className="code-block">{submission.compilerOutput}</pre>
                          </div>
                        )}
                        {submission.feedback && (
                          <div>
                            <div className="block-label">
                              Revisión · {formatDate(submission.reviewedAt)}
                            </div>
                            <div className="feedback">{submission.feedback}</div>
                          </div>
                        )}
                      </div>
                    )}

                    {openId !== submission.id && submission.feedback && (
                      <div className="submission-body">
                        <div className="feedback">{submission.feedback}</div>
                      </div>
                    )}
                  </article>
                ))}
              </div>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
