"use client";

import { memo, useEffect, useLayoutEffect, useRef, useState } from "react";
import { type Segment, type SessionPhase } from "@/lib/terminal-session";

type Props = {
  segments: Segment[];
  phase: SessionPhase;
  onLine: (text: string) => void;
  onEof: () => void;
  onCancel: () => void;
  onStart: () => void;
};

/**
 * La terminal. Pinta lo que el programa escribió y hace de línea de entrada
 * cuando el programa está pidiendo datos: nada de prompts inventados.
 *
 * El campo de entrada no se desmonta mientras se reejecuta el programa —así no
 * se pierde ni una pulsación y en el móvil no se cierra el teclado—: lo que se
 * teclee durante ese rato se envía en cuanto el programa vuelve a pedir datos.
 */
function TerminalView({ segments, phase, onLine, onEof, onCancel, onStart }: Props) {
  const [draft, setDraft] = useState("");
  const [queued, setQueued] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const live = phase === "waiting" || phase === "running";

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, phase]);

  useEffect(() => {
    if (phase === "waiting") inputRef.current?.focus();
  }, [phase]);

  // Lo tecleado mientras el programa se reejecutaba sale en cuanto vuelve a
  // pedir entrada.
  useEffect(() => {
    if (phase === "waiting" && queued !== null) {
      const text = queued;
      setQueued(null);
      onLine(text);
    }
  }, [phase, queued, onLine]);

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      if (phase === "waiting") {
        onLine(draft);
      } else {
        setQueued(draft);
      }
      setDraft("");
      return;
    }
    if (event.ctrlKey && (event.key === "d" || event.key === "D")) {
      event.preventDefault();
      onEof();
      return;
    }
    // Ctrl+C sólo corta si no hay texto seleccionado: si lo hay, se copia.
    if (event.ctrlKey && (event.key === "c" || event.key === "C")) {
      const selection = window.getSelection?.();
      if (selection && !selection.isCollapsed) return;
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="terminal"
      ref={scrollRef}
      onMouseUp={(event) => {
        // Un clic para enfocar, pero sin robar el foco si se está seleccionando texto.
        const selection = window.getSelection?.();
        if (selection && !selection.isCollapsed) return;
        if (live && (event.target as HTMLElement).tagName !== "BUTTON") inputRef.current?.focus();
      }}
    >
      <pre className="terminal-body">
        {segments.map((segment, index) => (
          <span key={index} className={`t-${segment.kind}`}>
            {segment.text}
          </span>
        ))}

        {live && (
          <span className={`terminal-input${phase === "running" ? " busy" : ""}`}>
            <input
              ref={inputRef}
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={handleKey}
              style={{ width: `${Math.max(draft.length + 1, 2)}ch` }}
              spellCheck={false}
              autoComplete="off"
              autoCapitalize="off"
              autoCorrect="off"
              aria-label="Entrada del programa"
            />
            {phase === "waiting" ? (
              <span className="caret" aria-hidden />
            ) : (
              <span className="t-info"> ⟳</span>
            )}
          </span>
        )}

        {queued !== null && <span className="t-info">{`\n[${queued} · se enviará al terminar]`}</span>}
      </pre>

      {phase === "idle" && (
        <div className="terminal-empty">
          <p>La terminal está vacía.</p>
          <button type="button" className="primary" onClick={onStart}>
            Compilar y ejecutar
          </button>
          <p className="hint">
            Se compila con g++ de verdad y el programa se ejecuta aquí. Si tu programa lee con
            <code> std::cin</code>, podrás escribir en esta misma terminal.
          </p>
        </div>
      )}

      {live && (
        <div className="terminal-help">
          {phase === "waiting" ? (
            <>
              Escribe y pulsa <kbd>Enter</kbd> · <kbd>Ctrl</kbd>+<kbd>D</kbd> cierra la entrada (EOF)
              · <kbd>Ctrl</kbd>+<kbd>C</kbd> corta la sesión
            </>
          ) : (
            <>
              Ejecutando… puedes seguir escribiendo: se enviará en cuanto el programa pida datos ·{" "}
              <kbd>Ctrl</kbd>+<kbd>C</kbd> corta
            </>
          )}
        </div>
      )}
    </div>
  );
}

export default memo(TerminalView);
