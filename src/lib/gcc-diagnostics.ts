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

/** Nombres con los que el compilador puede referirse al fichero del alumno. */
const SOURCE_NAMES = new Set([STUDENT_FILE, "<source>", "example.cpp"]);

function isStudentFile(file: string | undefined): boolean {
  return !file || SOURCE_NAMES.has(file);
}

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
 * Reescribe la salida del compilador para que hable del fichero del alumno: el
 * prólogo que se inyecta antes de su código desplaza los números de línea, así
 * que se restan aquí, tanto en los "fichero:línea:columna" como en el fragmento
 * de código con el caret que g++ imprime debajo. Así se conserva el mensaje
 * entero (que es lo que vería en su terminal) con los números de su editor.
 */
export function remapCompilerOutput(text: string, offset: number): string {
  if (!text) return "";
  // El fragmento de código que g++ imprime debajo ("   12 | int main() {") sólo
  // se renumera si el diagnóstico anterior hablaba del fichero del alumno: si
  // venía de una cabecera del sistema, sus números son los de esa cabecera.
  let inStudentFile = true;

  return text
    .split("\n")
    .map((line) => {
      // "In file included from X:N:" y sus continuaciones "     from X:N:"
      const included = line.match(/^(In file included from|\s+from)\s+(.+?):(\d+)(.*)$/);
      if (included) {
        const own = isStudentFile(included[2]);
        const number = Number(included[3]) - (own ? offset : 0);
        if (own && number < 1) return null; // la inclusión la hizo el prólogo
        inStudentFile = own;
        return `${included[1]} ${own ? STUDENT_FILE : included[2]}:${number}${included[4]}`;
      }

      const position = line.match(/^(.+?):(\d+)(:\d+)?:(.*)$/);
      if (position) {
        const own = isStudentFile(position[1]);
        inStudentFile = own;
        if (!own) return line;
        const number = Number(position[2]) - offset;
        if (number < 1) return null; // el diagnóstico apunta al prólogo
        return `${STUDENT_FILE}:${number}${position[3] ?? ""}:${position[4]}`;
      }

      const header = line.match(/^(.+?):(\s+(?:In |At ).*)$/);
      if (header) {
        const own = isStudentFile(header[1]);
        inStudentFile = own;
        return own ? `${STUDENT_FILE}:${header[2]}` : line;
      }

      const caret = line.match(/^(\s*)(\d+)(\s*\|.*)$/);
      if (caret && inStudentFile) {
        const number = Number(caret[2]) - offset;
        if (number < 1) return null;
        return `${caret[1]}${number}${caret[3]}`;
      }
      return line;
    })
    .filter((line): line is string => line !== null)
    .join("\n");
}

/**
 * Compiler Explorer ya entrega los diagnósticos estructurados en `tag`.
 * Se usan esos y, para las líneas que no traen tag (errores del enlazador,
 * del driver…), se cae al texto. `offset` son las líneas que el prólogo añadió
 * por delante del código del alumno.
 */
export function parseDiagnostics(lines: GodboltLine[] | undefined, offset = 0): CompilerNote[] {
  if (!Array.isArray(lines)) return [];
  const notes: CompilerNote[] = [];

  for (const entry of lines) {
    const tag = entry?.tag;
    if (tag && typeof tag.line === "number") {
      const message = stripAnsi(tag.text ?? "").replace(/^(fatal error|error|warning|note):\s*/, "");
      const own = isStudentFile(tag.file);
      const line = own ? tag.line - offset : tag.line;
      if (own && line < 1) continue; // diagnóstico del prólogo, no del alumno
      notes.push({
        file: own ? STUDENT_FILE : (tag.file as string),
        line,
        column: typeof tag.column === "number" && tag.column > 0 ? tag.column : null,
        severity: severityFromCode(tag.severity),
        message,
        inSource: own,
      });
      continue;
    }

    const raw = stripAnsi(entry?.text ?? "");
    if (!raw.trim() || CARET_ART.test(raw) || SUMMARY.test(raw) || CONTEXT.test(raw)) continue;

    const diag = raw.match(DIAG);
    if (diag) {
      const file = diag[1];
      const own = isStudentFile(file);
      const line = own ? Number(diag[2]) - offset : Number(diag[2]);
      if (own && line < 1) continue;
      notes.push({
        file: own ? STUDENT_FILE : file,
        line,
        column: diag[3] ? Number(diag[3]) : null,
        severity: severityOf(diag[4]),
        message: diag[5],
        inSource: own,
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
