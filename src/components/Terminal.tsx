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
 * La terminal. Sólo pinta lo que el programa escribió y hace de línea de
 * entrada cuando el programa está pidiendo datos: nada de prompts inventados.
 */
function TerminalView({ segments, phase, onLine, onEof, onCancel, onStart }: Props) {
  const [draft, setDraft] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [segments, phase]);

  useEffect(() => {
    if (phase === "waiting") inputRef.current?.focus();
  }, [phase]);

  function handleKey(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter") {
      event.preventDefault();
      onLine(draft);
      setDraft("");
      return;
    }
    if (event.key === "d" && event.ctrlKey) {
      event.preventDefault();
      onEof();
      return;
    }
    if (event.key === "c" && event.ctrlKey) {
      event.preventDefault();
      onCancel();
    }
  }

  return (
    <div
      className="terminal"
      ref={scrollRef}
      onClick={() => phase === "waiting" && inputRef.current?.focus()}
    >
      <pre className="terminal-body">
        {segments.map((segment, index) => (
          <span key={index} className={`t-${segment.kind}`}>
            {segment.text}
          </span>
        ))}

        {phase === "waiting" && (
          <span className="terminal-input">
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
            <span className="caret" aria-hidden />
          </span>
        )}

        {phase === "running" && <span className="t-info">▌</span>}
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

      {phase === "waiting" && (
        <div className="terminal-help">
          Escribe y pulsa <kbd>Enter</kbd> · <kbd>Ctrl</kbd>+<kbd>D</kbd> cierra la entrada (EOF) ·{" "}
          <kbd>Ctrl</kbd>+<kbd>C</kbd> corta la sesión
        </div>
      )}
    </div>
  );
}

export default memo(TerminalView);
