"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import CodeEditor from "@/components/CodeEditor";
import { formatDate } from "@/lib/format";
import { STATUS_LABELS, type Submission } from "@/lib/types";

type RunState = {
  status: string;
  statusLabel: string;
  console: string;
  exitCode: number | null;
  timeMs: number | null;
  compiler: string;
};

export default function StudentPage() {
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [stdin, setStdin] = useState("");
  const [run, setRun] = useState<RunState | null>(null);
  const [running, setRunning] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);

  // El handler vive en una ref para que el atajo del editor siempre vea el estado actual.
  const runRef = useRef<() => void>(() => {});

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

  const handleRun = useCallback(async () => {
    if (!code.trim()) {
      setRun({
        status: "vacio",
        statusLabel: "No hay código para compilar",
        console: "No hay código para compilar.",
        exitCode: null,
        timeMs: null,
        compiler: "",
      });
      return;
    }
    setRunning(true);
    setMessage(null);
    try {
      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code, stdin }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo compilar.");
      setRun(data as RunState);
    } catch (error) {
      setRun({
        status: "servicio",
        statusLabel: "No se pudo ejecutar el compilador",
        console:
          error instanceof Error
            ? `No se pudo ejecutar el compilador: ${error.message}`
            : "No se pudo ejecutar el compilador.",
        exitCode: null,
        timeMs: null,
        compiler: "",
      });
    } finally {
      setRunning(false);
    }
  }, [code, stdin]);

  runRef.current = handleRun;

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
          compilerOutput: run?.console ?? "",
        }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data?.error ?? "No se pudo guardar la entrega.");
      setMessage({ kind: "success", text: "Entrega enviada." });
      setOpenId(data.submission?.id ?? null);
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

  function reuse(submission: Submission) {
    setCode(submission.code);
    setStdin(submission.stdin);
    setTitle(submission.title === "Ejercicio sin título" ? "" : submission.title);
    setMessage({ kind: "success", text: "Código cargado en el editor." });
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const busy = running || submitting;
  const statusTone =
    run?.status === "ok"
      ? "ok"
      : run?.status === "error_compilacion" || run?.status === "error_ejecucion"
        ? "bad"
        : run
          ? "warn"
          : "";

  return (
    <div className="shell">
      <header className="topbar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>alumno</small>
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
              <span className="tab">main.cpp</span>
              <span className="grow" />
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setCode("");
                  setRun(null);
                  setMessage(null);
                }}
                disabled={busy}
              >
                Limpiar editor
              </button>
            </div>
            <CodeEditor value={code} onChange={setCode} onRun={() => runRef.current()} />
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
              <span className="grow" />
              {run && (
                <>
                  <span className={`dot-status ${statusTone}`}>{run.statusLabel}</span>
                  {run.timeMs != null && <span className="muted-chip">{run.timeMs} ms</span>}
                  {run.compiler && <span className="muted-chip">{run.compiler}</span>}
                  <button type="button" className="ghost" onClick={() => setRun(null)}>
                    Limpiar
                  </button>
                </>
              )}
            </div>
            <pre className={`console${run ? "" : " muted"}`}>
              {run ? run.console : "La consola aparecerá aquí."}
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
              <span className="grow" />
              <span className="muted-chip">{submissions.length}</span>
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
                    <button
                      type="button"
                      className="submission-head"
                      onClick={() => setOpenId(openId === submission.id ? null : submission.id)}
                    >
                      <span className="submission-main">
                        <span className="submission-title">{submission.title}</span>
                        <span className="submission-date">{formatDate(submission.createdAt)}</span>
                      </span>
                      <span className={`badge ${submission.reviewStatus}`}>
                        {STATUS_LABELS[submission.reviewStatus]}
                      </span>
                    </button>

                    {submission.feedback && openId !== submission.id && (
                      <div className="submission-body">
                        <div className="feedback">{submission.feedback}</div>
                      </div>
                    )}

                    {openId === submission.id && (
                      <div className="submission-body">
                        {submission.feedback && (
                          <div>
                            <div className="block-label">
                              Revisión del profesor · {formatDate(submission.reviewedAt)}
                            </div>
                            <div className="feedback">{submission.feedback}</div>
                          </div>
                        )}
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
                            <div className="block-label">Salida guardada</div>
                            <pre className="code-block">{submission.compilerOutput}</pre>
                          </div>
                        )}
                        <div>
                          <button type="button" onClick={() => reuse(submission)}>
                            Abrir en el editor
                          </button>
                        </div>
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
