"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { EditorSelection } from "@codemirror/state";
import { EditorView } from "@codemirror/view";
import { openSearchPanel } from "@codemirror/search";
import CodeEditor from "@/components/CodeEditor";
import Terminal from "@/components/Terminal";
import { colToIndex } from "@/lib/cm-diagnostics";
import { formatDate } from "@/lib/format";
import { highlightCpp } from "@/lib/cpp-highlight";
import { type CompilerNote } from "@/lib/gcc-diagnostics";
import { nextChunk, statusSegment, stdinFrom, type Segment, type SessionPhase } from "@/lib/terminal-session";
import { NOTE_LABELS, STATUS_LABELS, type Submission } from "@/lib/types";
import type { RunResult } from "@/lib/run-cpp";

type RunPayload = RunResult & { console: string };
type SidePanel = "explorador" | "revisiones" | null;
type BottomTab = "terminal" | "problemas" | "entrada";

const DRAFT_KEY = "cpp-lab:draft";
const PANEL_KEY = "cpp-lab:panel-h";
const MIN_PANEL = 120;
const MIN_EDITOR = 160;

export default function StudentPage() {
  // ---- documento
  const [code, setCode] = useState("");
  const [title, setTitle] = useState("");
  const [batchStdin, setBatchStdin] = useState("");
  const [restored, setRestored] = useState(false);

  // ---- interfaz
  const [side, setSide] = useState<SidePanel>("explorador");
  const [tab, setTab] = useState<BottomTab>("terminal");
  const [panelH, setPanelH] = useState(260);
  const [cursor, setCursor] = useState({ line: 1, column: 1, selected: 0 });
  const [wrap, setWrap] = useState(false);

  // ---- ejecución
  const [segments, setSegments] = useState<Segment[]>([]);
  const [phase, setPhase] = useState<SessionPhase>("idle");
  const [result, setResult] = useState<RunPayload | null>(null);
  const [diagnostics, setDiagnostics] = useState<CompilerNote[]>([]);
  const [runCode, setRunCode] = useState<string | null>(null);

  // ---- entregas
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [loadingList, setLoadingList] = useState(true);
  const [message, setMessage] = useState<{ kind: "error" | "success"; text: string } | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const viewRef = useRef<EditorView | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const sessionRef = useRef<{ code: string; lines: string[]; shown: string }>({
    code: "",
    lines: [],
    shown: "",
  });
  const wrapperRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<{ y: number; h: number; max: number } | null>(null);
  const collapsedRef = useRef(260);

  // ---------------------------------------------------------------- borrador
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(DRAFT_KEY);
      if (raw) {
        const draft = JSON.parse(raw);
        if (typeof draft.code === "string") setCode(draft.code);
        if (typeof draft.title === "string") setTitle(draft.title);
        if (typeof draft.stdin === "string") setBatchStdin(draft.stdin);
      }
      const h = Number(window.localStorage.getItem(PANEL_KEY));
      if (Number.isFinite(h) && h >= MIN_PANEL) setPanelH(h);
    } catch {
      // sin localStorage se empieza en blanco
    }
    setRestored(true);
  }, []);

  useEffect(() => {
    if (!restored) return;
    const id = window.setTimeout(() => {
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify({ code, title, stdin: batchStdin }));
      } catch {
        // el borrador es una comodidad, no la fuente de verdad
      }
    }, 400);
    return () => window.clearTimeout(id);
  }, [code, title, batchStdin, restored]);

  // ---------------------------------------------------------------- entregas
  const loadSubmissions = useCallback(async () => {
    setLoadingList(true);
    try {
      const response = await fetch("/api/submissions", { cache: "no-store" });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error ?? `El servidor respondió ${response.status}.`);
      }
      const data = await response.json();
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

  // --------------------------------------------------------------- ejecución
  const callRun = useCallback(
    async (source: string, stdin: string, mode: "interactive" | "batch"): Promise<RunPayload> => {
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      const response = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: source, stdin, mode }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error ?? `El servidor respondió ${response.status}.`);
      }
      return (await response.json()) as RunPayload;
    },
    [],
  );

  const applyResult = useCallback((payload: RunPayload) => {
    setResult(payload);
    setDiagnostics(payload.diagnostics ?? []);
  }, []);

  /** Lo que se guarda con la entrega es la sesión tal y como la vio el alumno. */
  const transcript = useMemo(() => segments.map((segment) => segment.text).join(""), [segments]);

  const start = useCallback(
    async (mode: "interactive" | "batch" = "interactive", stdin = "") => {
      if (!code.trim()) {
        abortRef.current?.abort();
        setSegments([{ kind: "warn", text: "No hay código para compilar.\n" }]);
        setPhase("done");
        setTab("terminal");
        return;
      }
      setTab("terminal");
      setPhase("running");
      setRunCode(code);
      sessionRef.current = { code, lines: stdin ? stdin.replace(/\n$/, "").split("\n") : [], shown: "" };

      const header: Segment[] = [
        { kind: "cmd", text: `$ g++ -std=c++17 -O1 -Wall main.cpp -o main\n` },
      ];
      setSegments(header);

      try {
        const payload = await callRun(code, stdin, mode);
        applyResult(payload);

        if (payload.status === "error_compilacion") {
          setSegments([
            ...header,
            { kind: "err", text: `${payload.compileOutput}\n` },
            statusSegment("La compilación falló: el programa no llegó a ejecutarse", null),
          ]);
          setPhase("done");
          setTab("problemas");
          return;
        }

        const next: Segment[] = [...header];
        if (payload.compileOutput) next.push({ kind: "warn", text: `${payload.compileOutput}\n` });
        next.push({ kind: "cmd", text: `$ ./main\n` });
        if (payload.stdout) next.push({ kind: "out", text: payload.stdout });
        sessionRef.current.shown = payload.stdout;

        if (payload.notice) next.push({ kind: "warn", text: `\n[${payload.notice}]\n` });

        if (payload.status === "entrada") {
          setSegments(next);
          setPhase("waiting");
          return;
        }
        if (payload.stderr) next.push({ kind: "err", text: `\n${payload.stderr}` });
        next.push(statusSegment(payload.statusLabel, payload.timeMs));
        setSegments(next);
        setPhase("done");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSegments([
          ...header,
          {
            kind: "err",
            text: `\n${error instanceof Error ? error.message : "No se pudo ejecutar el compilador."}\n`,
          },
        ]);
        setPhase("done");
      }
    },
    [applyResult, callRun, code],
  );

  const sendLine = useCallback(
    async (text: string) => {
      const session = sessionRef.current;
      const lines = [...session.lines, text];
      session.lines = lines;

      setSegments((current) => [...current, { kind: "echo", text: `${text}\n` }]);
      setPhase("running");

      try {
        const payload = await callRun(session.code, stdinFrom(lines), "interactive");
        applyResult(payload);

        if (payload.status === "servicio" || payload.status === "timeout") {
          setSegments((current) => [
            ...current,
            { kind: "err", text: `\n${payload.stderr || payload.statusLabel}\n` },
            statusSegment(payload.statusLabel, payload.timeMs),
          ]);
          setPhase("done");
          return;
        }

        const { delta, diverged } = nextChunk(session.shown, payload.stdout);
        session.shown = payload.stdout;

        setSegments((current) => {
          const next = [...current];
          if (diverged) {
            next.push({
              kind: "warn",
              text:
                "\n[este programa no imprime lo mismo dos veces con la misma entrada " +
                "(rand, time, memoria sin inicializar): abajo está la ejecución completa más reciente]\n",
            });
            next.push({ kind: "out", text: payload.stdoutFull });
          } else if (delta) {
            next.push({ kind: "out", text: delta });
          }
          if (!payload.waitingForInput) {
            if (payload.stderr) next.push({ kind: "err", text: `\n${payload.stderr}` });
            next.push(statusSegment(payload.statusLabel, payload.timeMs));
          }
          return next;
        });

        setPhase(payload.waitingForInput && !diverged ? "waiting" : "done");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
        setSegments((current) => [
          ...current,
          {
            kind: "err",
            text: `\n${error instanceof Error ? error.message : "No se pudo ejecutar el programa."}\n`,
          },
        ]);
        setPhase("done");
      }
    },
    [applyResult, callRun],
  );

  const sendEof = useCallback(async () => {
    const session = sessionRef.current;
    setSegments((current) => [...current, { kind: "info", text: "^D\n" }]);
    setPhase("running");
    try {
      const payload = await callRun(session.code, stdinFrom(session.lines), "batch");
      applyResult(payload);
      const { delta, diverged } = nextChunk(session.shown, payload.stdoutFull);
      setSegments((current) => [
        ...current,
        { kind: "out", text: diverged ? payload.stdoutFull : delta },
        ...(payload.stderr ? [{ kind: "err" as const, text: `\n${payload.stderr}` }] : []),
        statusSegment(payload.statusLabel, payload.timeMs),
      ]);
      setPhase("done");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      setPhase("done");
    }
  }, [applyResult, callRun]);

  const cancel = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setSegments((current) => [...current, { kind: "info", text: "^C\n" }]);
    setPhase("done");
  }, []);

  // ------------------------------------------------------------------ enviar
  async function submit() {
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
        body: JSON.stringify({ title: title.trim(), code, stdin: batchStdin, compilerOutput: transcript }),
      });
      if (!response.ok) {
        const detail = await response.json().catch(() => ({}));
        throw new Error(detail?.error ?? `El servidor respondió ${response.status}.`);
      }
      const data = await response.json();
      setMessage({ kind: "success", text: "Entrega enviada." });
      setOpenId(data.submission?.id ?? null);
      setSide("explorador");
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

  function openInEditor(submission: Submission) {
    if (code.trim() && code !== submission.code) {
      const ok = window.confirm(
        "Vas a sustituir lo que tienes en el editor por el código de esa entrega. ¿Seguimos?",
      );
      if (!ok) return;
    }
    abortRef.current?.abort();
    setCode(submission.code);
    setBatchStdin(submission.stdin);
    setTitle(submission.title === "Ejercicio sin título" ? "" : submission.title);
    setDiagnostics([]);
    setResult(null);
    setSegments([]);
    setPhase("idle");
    setRunCode(null);
    setMessage({ kind: "success", text: "Código cargado en el editor." });
  }

  const handleCursor = useCallback((line: number, column: number, selected: number) => {
    // Sin objeto nuevo si nada cambió: evita un render por pulsación.
    setCursor((current) =>
      current.line === line && current.column === column && current.selected === selected
        ? current
        : { line, column, selected },
    );
  }, []);

  const handleViewReady = useCallback((view: EditorView) => {
    viewRef.current = view;
  }, []);

  // ------------------------------------------------------------- diagnóstico
  const goToLine = useCallback((line: number, column: number | null) => {
    const view = viewRef.current;
    if (!view) return;
    const target = view.state.doc.line(Math.min(Math.max(line, 1), view.state.doc.lines));
    const pos = column == null ? target.from : Math.min(target.from + colToIndex(target.text, column), target.to);
    view.dispatch({
      selection: EditorSelection.cursor(pos),
      effects: EditorView.scrollIntoView(pos, { y: "center" }),
    });
    view.focus();
  }, []);

  // -------------------------------------------------------------- divisor
  const maxPanel = useCallback(
    () => Math.max(MIN_PANEL, (wrapperRef.current?.clientHeight ?? 800) - MIN_EDITOR),
    [],
  );

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    event.currentTarget.setPointerCapture(event.pointerId);
    dragRef.current = { y: event.clientY, h: panelH, max: maxPanel() };
    document.body.classList.add("resizing");
  }
  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag) return;
    setPanelH(Math.min(Math.max(drag.h - (event.clientY - drag.y), MIN_PANEL), drag.max));
  }
  function endDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragRef.current) return;
    dragRef.current = null;
    event.currentTarget.releasePointerCapture(event.pointerId);
    document.body.classList.remove("resizing");
    try {
      window.localStorage.setItem(PANEL_KEY, String(panelH));
    } catch {
      // da igual: es sólo la altura del panel
    }
  }
  function togglePanel() {
    setPanelH((current) => {
      if (current <= MIN_PANEL + 1) return collapsedRef.current;
      collapsedRef.current = current;
      return MIN_PANEL;
    });
  }
  function onSplitterKey(event: React.KeyboardEvent) {
    const step = event.shiftKey ? 48 : 16;
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setPanelH((h) => Math.min(h + step, maxPanel()));
    } else if (event.key === "ArrowDown") {
      event.preventDefault();
      setPanelH((h) => Math.max(h - step, MIN_PANEL));
    } else if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      togglePanel();
    }
  }

  // ------------------------------------------------------------- atajos
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.defaultPrevented) return;
      const mod = event.metaKey || event.ctrlKey;
      if (mod && event.key === "Enter" && !event.shiftKey) {
        event.preventDefault();
        void start();
      } else if (mod && event.shiftKey && event.key === "Enter") {
        event.preventDefault();
        if (!submitting) void submit();
      } else if (event.ctrlKey && event.key === "`") {
        event.preventDefault();
        togglePanel();
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [start, code, title, batchStdin, transcript]);

  const problems = diagnostics.filter((note) => note.severity !== "note");
  const errors = problems.filter((note) => note.severity === "error").length;
  const warnings = problems.filter((note) => note.severity === "warning").length;
  const pending = submissions.filter((item) => item.reviewStatus === "pendiente").length;
  const reviewed = useMemo(
    () => submissions.filter((item) => item.reviewStatus !== "pendiente"),
    [submissions],
  );
  const dirty = runCode !== null && runCode !== code;
  const busy = phase === "running" || submitting;

  return (
    <div className="ide">
      <header className="titlebar">
        <div className="brand">
          <span>
            Miguel <span className="dot">C++</span> Lab
          </span>
          <small>alumno</small>
        </div>
        <label className="exercise-name">
          <span>Ejercicio</span>
          <input
            type="text"
            value={title}
            maxLength={200}
            placeholder="Sin nombre"
            onChange={(event) => setTitle(event.target.value)}
          />
        </label>

        <div className="titlebar-actions">
          <button type="button" className="primary" onClick={() => void start()} disabled={busy}>
            {phase === "running" ? "Ejecutando…" : "Compilar y ejecutar"}
            <kbd>Ctrl+↵</kbd>
          </button>
          <button type="button" className="solid" onClick={() => void submit()} disabled={busy}>
            {submitting ? "Entregando…" : "Entregar"}
          </button>
          <Link href="/profesor" className="link-plain">
            /profesor
          </Link>
        </div>
      </header>

      <div className="ide-body">
        <nav className="rail" aria-label="Secciones">
          <button
            type="button"
            className={side === "explorador" ? "active" : ""}
            aria-pressed={side === "explorador"}
            title="Explorador"
            onClick={() => setSide(side === "explorador" ? null : "explorador")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M3 5.5A1.5 1.5 0 0 1 4.5 4h4l2 2.5h7A1.5 1.5 0 0 1 19 8v9.5A1.5 1.5 0 0 1 17.5 19h-13A1.5 1.5 0 0 1 3 17.5Z" />
            </svg>
            <span className="sr-only">Explorador</span>
          </button>
          <button
            type="button"
            title="Buscar en el código"
            onClick={() => viewRef.current && openSearchPanel(viewRef.current)}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <circle cx="11" cy="11" r="6" />
              <path d="m20 20-4.5-4.5" />
            </svg>
            <span className="sr-only">Buscar</span>
          </button>
          <button
            type="button"
            className={side === "revisiones" ? "active" : ""}
            aria-pressed={side === "revisiones"}
            title="Revisiones del profesor"
            onClick={() => setSide(side === "revisiones" ? null : "revisiones")}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden>
              <path d="M7 4h10a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Z" />
              <path d="m9 12 2 2 4-4" />
            </svg>
            <span className="sr-only">Revisiones</span>
            {reviewed.length > 0 && <i className="rail-badge">{reviewed.length}</i>}
          </button>
        </nav>

        {side && (
          <aside className="sidebar">
            {side === "explorador" ? (
              <>
                <div className="sidebar-head">Explorador</div>
                <div className="sidebar-section">
                  <div className="file-row active">
                    <span aria-hidden>📄</span> main.cpp {dirty && <i className="modified" />}
                  </div>
                </div>
                <div className="sidebar-head">
                  Mis entregas <span className="muted-chip">{submissions.length}</span>
                </div>
                <div className="sidebar-list">
                  {loadingList ? (
                    <p className="empty">Cargando…</p>
                  ) : submissions.length === 0 ? (
                    <p className="empty">Todavía no hay entregas.</p>
                  ) : (
                    submissions.map((submission) => (
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
                        {openId === submission.id && (
                          <div className="submission-body">
                            <pre className="code-block">{submission.code}</pre>
                            {submission.feedback && <div className="feedback">{submission.feedback}</div>}
                            <button type="button" onClick={() => openInEditor(submission)}>
                              Abrir en el editor
                            </button>
                          </div>
                        )}
                      </article>
                    ))
                  )}
                </div>
              </>
            ) : (
              <>
                <div className="sidebar-head">
                  Revisiones <span className="muted-chip">{reviewed.length}</span>
                </div>
                <div className="sidebar-list">
                  {reviewed.length === 0 ? (
                    <p className="empty">Todavía no hay revisiones.</p>
                  ) : (
                    reviewed.map((submission) => (
                      <article key={submission.id} className="review-card">
                        <div className="review-head">
                          <span className="submission-title">{submission.title}</span>
                          <span className={`badge ${submission.reviewStatus}`}>
                            {STATUS_LABELS[submission.reviewStatus]}
                          </span>
                        </div>
                        <div className="submission-date">{formatDate(submission.reviewedAt)}</div>
                        {submission.feedback && <div className="feedback">{submission.feedback}</div>}
                        {submission.reviewNotes.length > 0 && (
                          <ul className="note-list">
                            {submission.reviewNotes.map((note) => (
                              <li key={note.id} className={`note ${note.kind}`}>
                                <span className="note-line">línea {note.line}</span>
                                <span className="note-kind">{NOTE_LABELS[note.kind]}</span>
                                <pre className="note-code">
                                  {highlightCpp(submission.code.split("\n")[note.line - 1] ?? "", note.id)}
                                </pre>
                                <p>{note.body}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                        <button type="button" onClick={() => openInEditor(submission)}>
                          Abrir en el editor
                        </button>
                      </article>
                    ))
                  )}
                </div>
              </>
            )}
          </aside>
        )}

        <main className="workbench" ref={wrapperRef}>
          <div className="tabbar">
            <span className="file-tab">
              <span aria-hidden>C++</span> main.cpp {dirty && <i className="modified" />}
            </span>
            <span className="grow" />
            <label className="mini-toggle">
              <input type="checkbox" checked={wrap} onChange={(e) => setWrap(e.target.checked)} />
              Ajuste de línea
            </label>
          </div>

          <div className="editor-pane">
            <CodeEditor
              value={code}
              onChange={setCode}
              onRun={() => void start()}
              onSubmit={() => void submit()}
              onCursor={handleCursor}
              onViewReady={handleViewReady}
              diagnostics={diagnostics}
              wrap={wrap}
            />
          </div>

          <div
            className="splitter"
            role="separator"
            aria-orientation="horizontal"
            aria-label="Redimensionar el panel inferior"
            tabIndex={0}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={togglePanel}
            onKeyDown={onSplitterKey}
          />

          <section className="bottom-panel" style={{ height: panelH }}>
            <div className="panel-tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={tab === "terminal"}
                className={tab === "terminal" ? "active" : ""}
                onClick={() => setTab("terminal")}
              >
                Terminal
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "problemas"}
                className={tab === "problemas" ? "active" : ""}
                onClick={() => setTab("problemas")}
              >
                Problemas
                {errors > 0 && <i className="pill error">{errors}</i>}
                {warnings > 0 && <i className="pill warn">{warnings}</i>}
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === "entrada"}
                className={tab === "entrada" ? "active" : ""}
                onClick={() => setTab("entrada")}
              >
                Entrada
              </button>
              <span className="grow" />
              {result && <span className="muted-chip">{result.compiler}</span>}
              {phase === "running" && (
                <button type="button" className="ghost" onClick={cancel}>
                  Detener
                </button>
              )}
              <button
                type="button"
                className="ghost"
                onClick={() => {
                  setSegments([]);
                  setPhase("idle");
                }}
              >
                Limpiar
              </button>
            </div>

            <div className="panel-content" role="tabpanel">
              <div hidden={tab !== "terminal"} className="fill">
                <Terminal
                  segments={segments}
                  phase={phase}
                  onLine={(text) => void sendLine(text)}
                  onEof={() => void sendEof()}
                  onCancel={cancel}
                  onStart={() => void start()}
                />
              </div>

              <div hidden={tab !== "problemas"} className="fill problems">
                {result && result.status === "servicio" ? (
                  <p className="empty">No se pudo compilar: el servicio no respondió.</p>
                ) : problems.length === 0 ? (
                  <p className="empty">
                    {result ? "No hay problemas." : "Compila para ver los problemas."}
                  </p>
                ) : (
                  <ul>
                    {problems.map((note, index) => (
                      <li key={index}>
                        <button
                          type="button"
                          className={`problem ${note.severity}`}
                          onClick={() => note.line != null && goToLine(note.line, note.column)}
                          disabled={!note.inSource || note.line == null}
                        >
                          <span className="problem-icon" aria-hidden>
                            {note.severity === "error" ? "⊗" : "⚠"}
                          </span>
                          <span className="problem-text">{note.message}</span>
                          <span className="problem-pos">
                            {note.file}
                            {note.line != null ? `:${note.line}` : ""}
                            {note.column != null ? `:${note.column}` : ""}
                          </span>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              <div hidden={tab !== "entrada"} className="fill stdin-tab">
                <label className="field">
                  <span>Entrada completa (se envía de golpe, como `./main &lt; entrada.txt`)</span>
                  <textarea
                    value={batchStdin}
                    rows={6}
                    spellCheck={false}
                    placeholder={"18\n7"}
                    onChange={(event) => setBatchStdin(event.target.value)}
                  />
                </label>
                <div className="row">
                  <button
                    type="button"
                    onClick={() => void start("batch", batchStdin)}
                    disabled={busy}
                  >
                    Ejecutar con esta entrada
                  </button>
                  <span className="hint">
                    {batchStdin ? `${batchStdin.split("\n").length} líneas` : "vacía"} · también
                    puedes escribir directamente en la terminal mientras el programa corre
                  </span>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      <p aria-live="polite" className="sr-only">
        {phase === "running"
          ? "Compilando y ejecutando"
          : phase === "waiting"
            ? "El programa está esperando entrada"
            : (result?.statusLabel ?? "")}
        {message ? ` · ${message.text}` : ""}
      </p>

      <footer className="statusbar">
        <span className={`run-dot ${result?.status ?? "idle"}`}>
          {phase === "running" ? "Ejecutando…" : (result?.statusLabel ?? "Listo")}
        </span>
        <button type="button" className="status-btn" onClick={() => setTab("problemas")}>
          ⊗ {errors} ⚠ {warnings}
        </button>
        <span className="grow" />
        {message && <span className={`status-msg ${message.kind}`}>{message.text}</span>}
        <span>{pending > 0 ? `${pending} entrega(s) sin revisar` : ""}</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
          {cursor.selected > 0 ? ` (${cursor.selected} sel.)` : ""}
        </span>
        <span>Espacios: 4</span>
        <span>UTF-8</span>
        <span>C++17</span>
        <span>{result?.compiler ?? "g++ 13.2"}</span>
      </footer>

    </div>
  );
}
