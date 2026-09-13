/**
 * Diagnósticos del compilador, tal y como los emite g++.
 *
 * No se interpretan, no se traducen y no se sugieren correcciones: sólo se
 * ordenan para poder pintarlos en el margen del editor y en la lista de
 * problemas. El módulo es puro (no importa CodeMirror) para que /profesor
 * pueda usarlo sin arrastrar el editor a su bundle.
 */

export type DiagnosticSeverity = "error" | "warning" | "note";

export type CompilerNote = {
  file: string;
  line: number | null;
  column: number | null;
  severity: DiagnosticSeverity;
  message: string;
  /** Verdadero cuando la posición apunta al fichero del alumno. */
  inSource: boolean;
};

/** El fichero del alumno; el prólogo inyectado usa #line para que coincida. */
export const STUDENT_FILE = "main.cpp";

// Secuencias ANSI: CSI (incluye parámetros privados como ?25l) y OSC.
const ANSI = new RegExp(
  `${String.fromCharCode(27)}(?:\\[[0-9;?]*[ -/]*[@-~]|\\][^${String.fromCharCode(7)}]*(?:${String.fromCharCode(
    7,
  )}|${String.fromCharCode(27)}\\\\))`,
  "g",
);

export function stripAnsi(text: string): string {
  return text.replace(ANSI, "");
}

/** "<fichero>:<línea>[:<col>]: error|warning|note: mensaje" */
const DIAG = /^(.+?):(\d+)(?::(\d+))?:\s*(fatal error|error|warning|note):\s*(.*)$/;
/** "cc1plus: error: ..." o "ld: error: ..." — sin posición. */
const TOOL = /^([\w.+-]+):\s*(fatal error|error|warning|note):\s*(.*)$/;
/** Arte del caret: "    5 |     cout << x;" y "      |     ^~~~". */
const CARET_ART = /^\s*(?:\d+|\+{3}|\.{3})?\s*\|/;
/** Sumarios y contexto que no son diagnósticos. */
const SUMMARY = /^(compilation terminated\.|\d+ (warning|error)s? generated\.)$/;
const CONTEXT = /:\s+(In (function|member function|constructor|destructor|instantiation|file included)|At global scope)/;

function severityOf(word: string): DiagnosticSeverity {
  if (word === "fatal error" || word === "error") return "error";
  if (word === "warning") return "warning";
  return "note";
}

function severityFromCode(code: number | undefined): DiagnosticSeverity {
  if (code === 3) return "error";
  if (code === 2) return "warning";
  return "note";
}

export type GodboltLine = {
  text?: string;
  tag?: { file?: string; line?: number; column?: number; text?: string; severity?: number };
};

/**
 * Compiler Explorer ya entrega los diagnósticos estructurados en `tag`.
 * Se usan esos y, para las líneas que no traen tag (errores del enlazador,
 * del driver…), se cae al texto.
 */
export function parseDiagnostics(lines: GodboltLine[] | undefined): CompilerNote[] {
  if (!Array.isArray(lines)) return [];
  const notes: CompilerNote[] = [];

  for (const entry of lines) {
    const tag = entry?.tag;
    if (tag && typeof tag.line === "number") {
      const message = stripAnsi(tag.text ?? "").replace(/^(fatal error|error|warning|note):\s*/, "");
      notes.push({
        file: tag.file || STUDENT_FILE,
        line: tag.line,
        column: typeof tag.column === "number" && tag.column > 0 ? tag.column : null,
        severity: severityFromCode(tag.severity),
        message,
        inSource: !tag.file || tag.file === STUDENT_FILE || tag.file === "<source>",
      });
      continue;
    }

    const raw = stripAnsi(entry?.text ?? "");
    if (!raw.trim() || CARET_ART.test(raw) || SUMMARY.test(raw) || CONTEXT.test(raw)) continue;

    const diag = raw.match(DIAG);
    if (diag) {
      const file = diag[1];
      notes.push({
        file,
        line: Number(diag[2]),
        column: diag[3] ? Number(diag[3]) : null,
        severity: severityOf(diag[4]),
        message: diag[5],
        inSource: file === STUDENT_FILE || file === "<source>",
      });
      continue;
    }

    const tool = raw.match(TOOL);
    if (tool) {
      notes.push({
        file: tool[1],
        line: null,
        column: null,
        severity: severityOf(tool[2]),
        message: tool[3],
        inSource: false,
      });
    }
  }

  return dedupe(notes).slice(0, 200);
}

function dedupe(notes: CompilerNote[]): CompilerNote[] {
  const seen = new Set<string>();
  return notes.filter((note) => {
    const key = `${note.file}:${note.line}:${note.column}:${note.severity}:${note.message}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

export function countBySeverity(notes: CompilerNote[]) {
  return {
    errors: notes.filter((n) => n.severity === "error").length,
    warnings: notes.filter((n) => n.severity === "warning").length,
  };
}
