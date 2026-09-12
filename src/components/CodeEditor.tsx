"use client";

import dynamic from "next/dynamic";
import { cpp } from "@codemirror/lang-cpp";
import { vscodeDark } from "@uiw/codemirror-theme-vscode";

// CodeMirror toca el DOM: se carga sólo en el navegador.
const CodeMirror = dynamic(() => import("@uiw/react-codemirror"), {
  ssr: false,
  loading: () => <div className="editor-fallback" aria-hidden />,
});

type Props = {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  readOnly?: boolean;
};

export default function CodeEditor({ value, onChange, height = "430px", readOnly = false }: Props) {
  return (
    <div className="editor-wrap">
      <CodeMirror
        value={value}
        height={height}
        theme={vscodeDark}
        extensions={[cpp()]}
        onChange={onChange}
        readOnly={readOnly}
        basicSetup={{
          lineNumbers: true,
          highlightActiveLine: true,
          highlightActiveLineGutter: true,
          bracketMatching: true,
          closeBrackets: true,
          indentOnInput: true,
          // Nada de autocompletado: el laboratorio no sugiere soluciones.
          autocompletion: false,
          searchKeymap: false,
        }}
        placeholder="// Escribe aquí tu programa en C++"
      />
    </div>
  );
}
