"use client";

import { useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { autocompletion } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { indentUnit } from "@codemirror/language";
import { Prec } from "@codemirror/state";
import { EditorView, keymap } from "@codemirror/view";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { cppCompletions } from "@/lib/cpp-completions";

// CodeMirror toca el DOM: se carga sólo en el navegador.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="editor-fallback" aria-hidden />,
});

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  height?: string;
  readOnly?: boolean;
};

export default function CodeEditor({
  value,
  onChange,
  onRun,
  height = "480px",
  readOnly = false,
}: Props) {
  const [cursor, setCursor] = useState({ line: 1, column: 1 });

  const extensions = useMemo(
    () => [
      cpp(),
      indentUnit.of("    "),
      EditorView.lineWrapping,
      autocompletion({
        override: [cppCompletions],
        activateOnTyping: true,
        icons: true,
      }),
      // Prec.highest: el atajo debe ganar al keymap por defecto de CodeMirror.
      Prec.highest(
        keymap.of([
          {
            key: "Mod-Enter",
            preventDefault: true,
            run: () => {
              onRun?.();
              return true;
            },
          },
        ]),
      ),
    ],
    [onRun],
  );

  const lines = value ? value.split("\n").length : 1;

  return (
    <div className="editor-wrap">
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        indentWithTab
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          foldGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          highlightSelectionMatches: true,
          autocompletion: false, // lo aporta la extensión de arriba
        }}
        onUpdate={(view) => {
          const head = view.state.selection.main.head;
          const line = view.state.doc.lineAt(head);
          setCursor({ line: line.number, column: head - line.from + 1 });
        }}
        placeholder="// Escribe aquí tu programa en C++"
      />
      <div className="editor-status">
        <span>C++17</span>
        <span>UTF-8</span>
        <span>
          Ln {cursor.line}, Col {cursor.column}
        </span>
        <span>{lines} líneas</span>
        <span className="grow" />
        <span>Ctrl/⌘ + Enter · compilar</span>
        <span>Ctrl/⌘ + Espacio · sugerencias</span>
      </div>
    </div>
  );
}
