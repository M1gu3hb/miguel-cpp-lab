import { type Diagnostic } from "@codemirror/lint";
import { type Text } from "@codemirror/state";
import { type CompilerNote } from "./gcc-diagnostics";

/**
 * Traduce los diagnósticos de g++ a los de CodeMirror. Sin acciones rápidas:
 * el editor subraya lo que dijo el compilador y no propone arreglos.
 */

const TAB = 4; // igual que -ftabstop e indentUnit

/** g++ cuenta columnas de visualización; CodeMirror, índices UTF-16. */
export function colToIndex(text: string, col1: number): number {
  let col = 1;
  let i = 0;
  while (i < text.length) {
    if (col >= col1) return i;
    const cp = text.codePointAt(i) ?? 0;
    i += cp > 0xffff ? 2 : 1;
    col += cp === 9 ? TAB - ((col - 1) % TAB) : 1;
  }
  return text.length;
}

function wordEnd(text: string, from: number): number {
  let j = from;
  while (j < text.length && /[A-Za-z0-9_]/.test(text[j])) j++;
  return j > from ? j : from + 1;
}

export function toCmDiagnostics(doc: Text, notes: CompilerNote[]): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const note of notes) {
    if (!note.inSource || note.line == null) continue;

    // Las notas del compilador se pliegan dentro del diagnóstico anterior.
    if (note.severity === "note" && out.length) {
      const prev = out[out.length - 1];
      prev.message = `${prev.message}\n${note.message}`;
      continue;
    }

    const lineNo = Math.min(Math.max(note.line, 1), doc.lines);
    const line = doc.line(lineNo);

    let from = line.from;
    let to = line.to;
    if (note.column != null) {
      const start = colToIndex(line.text, note.column);
      from = Math.min(line.from + start, line.to);
      to = Math.min(line.from + wordEnd(line.text, start), line.to);
    }
    if (to <= from) {
      // Un diagnóstico vacío no pinta nada: retrocede un carácter.
      from = Math.max(line.from, Math.min(from, line.to - 1));
      to = Math.max(from + 1, line.to);
    }

    out.push({
      from,
      to,
      severity: note.severity === "note" ? "info" : note.severity,
      source: note.file,
      message: note.message,
    });
  }

  return out;
}
