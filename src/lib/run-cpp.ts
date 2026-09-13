/**
 * Ejecución real de C++ contra Compiler Explorer (godbolt.org).
 *
 * Dos cosas que hacen que la consola se comporte como una terminal de verdad:
 *
 *  1. Se antepone un prólogo que pone `std::cout` en modo sin búfer. Sin eso, si
 *     el programa muere por una señal se pierde todo lo que había impreso, que es
 *     justo lo contrario de lo que pasa en una terminal.
 *  2. Ese mismo prólogo envuelve el buffer de `std::cin`: cuando el programa pide
 *     un carácter y ya no queda entrada, emite una marca. Esa marca es el punto
 *     EXACTO en el que un programa de verdad se quedaría esperando a que teclees.
 *     Todo lo que el proceso imprime después de esa marca es consecuencia de que
 *     la entrada se cerró, así que en modo interactivo se oculta hasta que el
 *     alumno escriba la siguiente línea.
 *
 * `#line 1 "main.cpp"` cierra el prólogo para que los números de línea y los
 * nombres de fichero de los errores sigan siendo los del alumno.
 */
import { countBySeverity, parseDiagnostics, stripAnsi, type CompilerNote } from "./gcc-diagnostics";

const COMPILER = process.env.CPP_COMPILER_ID ?? "g132"; // GCC 13.2
const COMPILER_LABEL = process.env.CPP_COMPILER_LABEL ?? "g++ 13.2";
const ARGS = process.env.CPP_COMPILER_ARGS ?? "-std=c++17 -O1 -Wall -ftabstop=4";
const ENDPOINT = "https://godbolt.org/api/compiler";
const USER_AGENT = "miguel-cpp-lab (https://miguel-cpp-lab.vercel.app)";
const REQUEST_TIMEOUT_MS = 28_000;
const MAX_OUTPUT = 60_000;

/** Marca que el prólogo imprime cuando el programa pide entrada y no la hay. */
const WAIT_MARK = "LAB_STDIN_WAIT";

const PROLOGUE =
  '#include <iostream>\n' +
  '#include <streambuf>\n' +
  'namespace lab_rt {\n' +
  'struct MarkBuf : std::streambuf {\n' +
  '  std::streambuf* inner; char ch = 0; bool marked = false;\n' +
  '  explicit MarkBuf(std::streambuf* b) : inner(b) {}\n' +
  '  int_type underflow() override {\n' +
  '    if (gptr() && gptr() < egptr()) return traits_type::to_int_type(*gptr());\n' +
  '    int_type c = inner->sbumpc();\n' +
  '    if (traits_type::eq_int_type(c, traits_type::eof())) {\n' +
  `      if (!marked) { marked = true; std::cout << "${WAIT_MARK}" << std::flush; }\n` +
  '      return traits_type::eof();\n' +
  '    }\n' +
  '    ch = traits_type::to_char_type(c);\n' +
  '    setg(&ch, &ch, &ch + 1);\n' +
  '    return traits_type::to_int_type(ch);\n' +
  '  }\n' +
  '};\n' +
  'struct Init { Init() { std::cout << std::unitbuf; static MarkBuf b(std::cin.rdbuf()); std::cin.rdbuf(&b); } } init;\n' +
  '}\n' +
  '#line 1 "main.cpp"\n';

export type RunStatus =
  | "ok"
  | "entrada"
  | "error_compilacion"
  | "error_ejecucion"
  | "senal"
  | "timeout"
  | "servicio";

export type RunResult = {
  status: RunStatus;
  statusLabel: string;
  commandLine: string;
  runLine: string;
  compileOutput: string;
  diagnostics: CompilerNote[];
  errors: number;
  warnings: number;
  /** Lo que se muestra: cortado en la marca cuando el programa pide entrada. */
  stdout: string;
  /** Todo lo que escribió el proceso, ya sin la marca. */
  stdoutFull: string;
  waitingForInput: boolean;
  stderr: string;
  exitCode: number | null;
  signal: string | null;
  timedOut: boolean;
  truncated: boolean;
  timeMs: number | null;
  compiler: string;
};

type GodboltLine = { text?: string; tag?: Record<string, unknown> };
type GodboltResponse = {
  code?: number;
  didExecute?: boolean;
  timedOut?: boolean;
  truncated?: boolean;
  execTime?: number | string;
  stdout?: GodboltLine[];
  stderr?: GodboltLine[];
  buildResult?: {
    code?: number;
    timedOut?: boolean;
    truncated?: boolean;
    stdout?: GodboltLine[];
    stderr?: GodboltLine[];
  };
};

const SIGNALS: Record<number, string> = {
  2: "SIGINT",
  4: "SIGILL",
  6: "SIGABRT",
  8: "SIGFPE (división por cero o desbordamiento aritmético)",
  9: "SIGKILL",
  11: "SIGSEGV (acceso inválido a memoria)",
  13: "SIGPIPE",
  15: "SIGTERM",
};

function joinLines(lines: GodboltLine[] | undefined): string {
  if (!Array.isArray(lines)) return "";
  const joined = lines.map((line) => stripAnsi(line?.text ?? "")).join("\n");
  return joined.length > MAX_OUTPUT
    ? `${joined.slice(0, MAX_OUTPUT)}\n[la consola cortó la salida a ${MAX_OUTPUT} caracteres]`
    : joined;
}

export const COMMAND_LINE = `g++ ${ARGS} main.cpp -o main`;

export type RunOptions = {
  /** "interactive" oculta la cola posterior a la marca; "batch" muestra todo. */
  mode?: "interactive" | "batch";
  signal?: AbortSignal;
};

export async function runCpp(code: string, stdin: string, options: RunOptions = {}): Promise<RunResult> {
  const mode = options.mode ?? "batch";
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  // Si el navegador cancela, se cancela también la petición a godbolt.
  const signal =
    options.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;

  let payload: GodboltResponse;
  try {
    const response = await fetch(`${ENDPOINT}/${COMPILER}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal,
      body: JSON.stringify({
        source: PROLOGUE + code,
        lang: "c++",
        options: {
          userArguments: ARGS,
          executeParameters: { args: [], stdin },
          compilerOptions: { executorRequest: true, skipAsm: true },
          filters: { execute: true },
        },
      }),
    });

    if (!response.ok) {
      return service(`El servicio de compilación respondió ${response.status}.`);
    }
    const text = await response.text();
    try {
      payload = JSON.parse(text) as GodboltResponse;
    } catch {
      return service("El servicio de compilación devolvió una respuesta que no se pudo leer.");
    }
    if (!payload || typeof payload !== "object" || !("buildResult" in payload)) {
      // Falla ruidosamente: un formato inesperado no puede parecer "todo bien".
      return service("El servicio de compilación cambió de formato: revisa la integración.");
    }
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    if (aborted) {
      return {
        ...service("La compilación superó el límite de tiempo."),
        status: "timeout",
        statusLabel: "Tiempo de espera agotado",
        timedOut: true,
      };
    }
    return service("No se pudo contactar con el servicio de compilación.");
  } finally {
    clearTimeout(timer);
  }

  const build = payload.buildResult ?? {};
  const diagnostics = parseDiagnostics(build.stderr as never);
  const { errors, warnings } = countBySeverity(diagnostics);
  const compileOutput = [joinLines(build.stdout), joinLines(build.stderr)].filter(Boolean).join("\n");

  if ((build.code ?? 0) !== 0) {
    return {
      ...base(),
      status: "error_compilacion",
      statusLabel: "Error de compilación",
      compileOutput,
      diagnostics,
      errors,
      warnings,
      exitCode: build.code ?? null,
    };
  }

  const rawOut = joinLines(payload.stdout);
  const markIndex = rawOut.indexOf(WAIT_MARK);
  const waitingForInput = markIndex !== -1;
  const stdoutFull = rawOut.split(WAIT_MARK).join("");
  const stdout =
    waitingForInput && mode === "interactive" ? rawOut.slice(0, markIndex) : stdoutFull;

  const stderr = joinLines(payload.stderr);
  const exitCode = typeof payload.code === "number" ? payload.code : null;
  const timedOut = Boolean(payload.timedOut) || /processing time exceeded/i.test(stderr);
  const truncated = Boolean(payload.truncated) || Boolean(build.truncated);
  const rawTime = payload.execTime != null ? Number(payload.execTime) : null;
  const timeMs = rawTime != null && Number.isFinite(rawTime) ? rawTime : null;
  const signalName =
    exitCode != null && exitCode > 128 ? (SIGNALS[exitCode - 128] ?? `señal ${exitCode - 128}`) : null;

  const common = {
    ...base(),
    compileOutput,
    diagnostics,
    errors,
    warnings,
    stdout,
    stdoutFull,
    waitingForInput,
    stderr,
    exitCode,
    signal: signalName,
    timedOut,
    truncated,
    timeMs,
  };

  if (timedOut) {
    return {
      ...common,
      status: "timeout",
      statusLabel: "El programa no terminó a tiempo (posible bucle infinito)",
    };
  }
  if (waitingForInput && mode === "interactive") {
    return { ...common, status: "entrada", statusLabel: "El programa está leyendo de la entrada" };
  }
  if (signalName) {
    return {
      ...common,
      status: "senal",
      statusLabel: `El programa se cerró de forma anormal: ${signalName}`,
    };
  }
  if (exitCode == null) {
    return {
      ...common,
      status: "error_ejecucion",
      statusLabel: "El programa terminó sin informar de su código de salida",
    };
  }
  if (exitCode !== 0) {
    return {
      ...common,
      status: "error_ejecucion",
      statusLabel: `El programa terminó con código ${exitCode}`,
    };
  }
  return { ...common, status: "ok", statusLabel: "El programa terminó correctamente (código 0)" };
}

function base(): RunResult {
  return {
    status: "ok",
    statusLabel: "",
    commandLine: COMMAND_LINE,
    runLine: "./main",
    compileOutput: "",
    diagnostics: [],
    errors: 0,
    warnings: 0,
    stdout: "",
    stdoutFull: "",
    waitingForInput: false,
    stderr: "",
    exitCode: null,
    signal: null,
    timedOut: false,
    truncated: false,
    timeMs: null,
    compiler: COMPILER_LABEL,
  };
}

function service(message: string): RunResult {
  return {
    ...base(),
    status: "servicio",
    statusLabel: "El servicio de compilación no respondió",
    stderr: message,
  };
}

/** Transcripción en texto plano, la que se guarda junto a la entrega. */
export function formatRunResult(result: RunResult): string {
  const blocks = [
    `$ ${result.commandLine}`,
    result.compileOutput,
    result.status === "error_compilacion" ? "" : `$ ${result.runLine}`,
    result.stdoutFull,
    result.stderr,
    `[${result.statusLabel}${result.timeMs != null ? ` · ${result.timeMs} ms` : ""}]`,
  ].filter((block) => block && block.length);

  return blocks.join("\n");
}
