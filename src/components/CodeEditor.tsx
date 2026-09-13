"use client";

import { useCallback, useEffect, useMemo, useRef } from "react";
import dynamic from "next/dynamic";
import { autocompletion } from "@codemirror/autocomplete";
import { cpp } from "@codemirror/lang-cpp";
import { indentUnit } from "@codemirror/language";
import { diagnosticCount, lintGutter, setDiagnostics } from "@codemirror/lint";
import { diagnosticMarks, setMarks } from "@/lib/diagnostic-marks";
import { EditorState, Prec } from "@codemirror/state";
import { search } from "@codemirror/search";
import { EditorView, keymap, type ViewUpdate } from "@codemirror/view";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";
import { cppCompletions } from "@/lib/cpp-completions";
import { toCmDiagnostics } from "@/lib/cm-diagnostics";
import { type CompilerNote } from "@/lib/gcc-diagnostics";

/**
 * La primera llamada a setDiagnostics instala el campo de estado de lint, y ese
 * mismo despacho ya no llega al campo recién creado. Por eso se comprueba y, si
 * hace falta, se repite: así los subrayados aparecen también en la primera
 * compilación.
 */
function paint(view: EditorView, list: ReturnType<typeof toCmDiagnostics>) {
  view.dispatch({ effects: setMarks.of(list) });
  view.dispatch(setDiagnostics(view.state, list));
  if (list.length > 0 && diagnosticCount(view.state) === 0) {
    view.dispatch(setDiagnostics(view.state, list));
  }
}

/**
 * Constante de módulo a propósito: @uiw/react-codemirror mete `basicSetup` y
 * `onUpdate` en las dependencias de su efecto de reconfiguración. Si cambian de
 * identidad en cada render, el editor se reconfigura en cada tecla —lo que tira
 * el estado que instalan setDiagnostics y openSearchPanel— y realimenta un bucle
 * de renders.
 */
const BASIC_SETUP = {
  lineNumbers: true,
  highlightActiveLine: true,
  highlightActiveLineGutter: true,
  foldGutter: true,
  bracketMatching: true,
  closeBrackets: true,
  indentOnInput: true,
  highlightSelectionMatches: true,
  autocompletion: false, // lo aporta la extensión de abajo
  lintKeymap: false, // evita el panel de lint propio de CodeMirror
} as const;

// CodeMirror toca el DOM: se carga sólo en el navegador.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="editor-fallback" aria-hidden />,
});

type Props = {
  value: string;
  onChange: (value: string) => void;
  onRun?: () => void;
  onSubmit?: () => void;
  onCursor?: (line: number, column: number, selected: number) => void;
  onViewReady?: (view: EditorView) => void;
  diagnostics?: CompilerNote[];
  readOnly?: boolean;
  wrap?: boolean;
  fontSize?: number;
  tabSize?: number;
};

export default function CodeEditor({
  value,
  onChange,
  onRun,
  onSubmit,
  onCursor,
  onViewReady,
  diagnostics = [],
  readOnly = false,
  wrap = false,
  fontSize = 14,
  tabSize = 4,
}: Props) {
  const viewRef = useRef<EditorView | null>(null);
  // Los callbacks viven en refs: si entraran en el array de extensiones, cada
  // render reconfiguraría el editor y se perderían los diagnósticos ya pintados.
  const runRef = useRef(onRun);
  const submitRef = useRef(onSubmit);
  const cursorRef = useRef(onCursor);
  runRef.current = onRun;
  submitRef.current = onSubmit;
  cursorRef.current = onCursor;

  const extensions = useMemo(
    () => [
      cpp(),
      // En la configuración base, para que openSearchPanel no tenga que
      // añadirla al vuelo (y sobreviva a una reconfiguración).
      search(),
      indentUnit.of(" ".repeat(tabSize)),
      EditorState.tabSize.of(tabSize),
      lintGutter(),
      diagnosticMarks,
      ...(wrap ? [EditorView.lineWrapping] : []),
      EditorView.theme({ "&": { fontSize: `${fontSize}px` } }),
      autocompletion({ override: [cppCompletions], activateOnTyping: true, icons: true }),
      // Prec.highest: estos atajos deben ganar al keymap por defecto.
      Prec.highest(
        keymap.of([
          { key: "Mod-Enter", preventDefault: true, run: () => (runRef.current?.(), true) },
          { key: "Mod-Shift-Enter", preventDefault: true, run: () => (submitRef.current?.(), true) },
          {
            // Tab indenta, así que hace falta una salida explícita del editor.
            key: "Escape",
            run: (view) => {
              view.contentDOM.blur();
              return true;
            },
          },
        ]),
      ),
    ],
    [wrap, fontSize, tabSize],
  );

  // Los diagnósticos vienen del compilador: se pintan con setDiagnostics y
  // nunca con linter(), que instalaría un analizador local.
  useEffect(() => {
    const view = viewRef.current;
    if (!view) return;
    paint(view, toCmDiagnostics(view.state.doc, diagnostics));
    // wrap/fontSize/tabSize reconfiguran el editor: hay que volver a pintarlos.
  }, [diagnostics, wrap, fontSize, tabSize]);

  const handleUpdate = useCallback((update: ViewUpdate) => {
    const report = cursorRef.current;
    if (!report || (!update.selectionSet && !update.docChanged)) return;
    const range = update.state.selection.main;
    const line = update.state.doc.lineAt(range.head);
    report(line.number, range.head - line.from + 1, range.to - range.from);
  }, []);

  return (
    <div className="editor-wrap">
      <CodeMirror
        value={value}
        height="100%"
        theme={vscodeDark}
        extensions={extensions}
        onChange={onChange}
        readOnly={readOnly}
        indentWithTab
        basicSetup={BASIC_SETUP}
        onCreateEditor={(view) => {
          viewRef.current = view;
          onViewReady?.(view);
          if (diagnostics.length) paint(view, toCmDiagnostics(view.state.doc, diagnostics));
        }}
        onUpdate={handleUpdate}
        placeholder="// Escribe aquí tu programa en C++"
      />
    </div>
  );
}
