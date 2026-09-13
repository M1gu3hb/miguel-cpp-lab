/**
 * Ejecución real de C++ contra Compiler Explorer (godbolt.org).
 *
 * Tres cosas sostienen que la terminal se comporte como una de verdad:
 *
 *  1. Se antepone un prólogo que pone `std::cout` en modo sin búfer. Sin eso, un
 *     programa que muere por una señal pierde todo lo que había impreso, justo al
 *     revés que en una terminal.
 *  2. Ese prólogo envuelve el buffer de `std::cin`: cuando el programa pide un
 *     carácter y ya no queda entrada, imprime una marca. Esa marca es el punto
 *     EXACTO en el que un programa real se quedaría esperando a que teclees. La
 *     marca lleva un token aleatorio por petición, así que el código del alumno
 *     no puede falsificarla.
 *  3. El prólogo termina en `#line 1 "main.cpp"`, de modo que los errores del
 *     compilador siguen citando las líneas del alumno.
 *
 * Como el prólogo incluye <iostream>, un programa al que le falte ese include
 * compilaría aquí y no con g++ a secas. Para no mentir, cuando se pide
 * verificación se compila EN PARALELO el código tal cual lo escribió el alumno y
 * mandan sus diagnósticos.
 */
import { randomBytes } from "node:crypto";
import {
  countBySeverity,
  parseDiagnostics,
  remapCompilerOutput,
  stripAnsi,
  type CompilerNote,
} from "./gcc-diagnostics";

const COMPILER = process.env.CPP_COMPILER_ID ?? "g132"; // GCC 13.2
const COMPILER_LABEL = process.env.CPP_COMPILER_LABEL ?? "g++ 13.2";
const ARGS = process.env.CPP_COMPILER_ARGS ?? "-std=c++17 -O1 -Wall -ftabstop=4";
const ENDPOINT = "https://godbolt.org/api/compiler";
const USER_AGENT = "miguel-cpp-lab (https://miguel-cpp-lab.vercel.app)";
const REQUEST_TIMEOUT_MS = 28_000;
const MAX_OUTPUT = 60_000;

/**
 * Programas que leen sin pasar por `std::cin`: la marca nunca se emite, así que
 * la sesión interactiva no es posible y se dice en vez de fingirla.
 * `sync_with_stdio` no está en la lista: el prólogo lo sobrevive (ver abajo).
 */
const BYPASSES_CIN = /\b(scanf|getchar|getc|fgets|gets|fread|freopen)\s*\(|\bcin\s*\.\s*rdbuf\s*\(/;

function markToken(): string {
  return `LAB${randomBytes(8).toString("hex").toUpperCase()}WAIT`;
}

function prologue(mark: string): string {
  return (
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
    `      if (!marked) { marked = true; std::cout << "${mark}" << std::flush; }\n` +
    '      return traits_type::eof();\n' +
    '    }\n' +
    '    ch = traits_type::to_char_type(c);\n' +
    '    setg(&ch, &ch, &ch + 1);\n' +
    '    return traits_type::to_int_type(ch);\n' +
    '  }\n' +
    '};\n' +
    // `ios::sync_with_stdio(false)` reinstala el buffer de cin y se llevaría por
    // delante el nuestro. La macro vuelve a engancharlo justo después; va al
    // final del prólogo para no romper la declaración del propio header.
    'inline MarkBuf*& slot() { static MarkBuf* p = nullptr; return p; }\n' +
    'inline void attach() {\n' +
    '  if (slot() && std::cin.rdbuf() == slot()) return;\n' +
    '  MarkBuf* nb = new MarkBuf(std::cin.rdbuf());\n' +
    '  if (slot()) nb->marked = slot()->marked;\n' +
    '  slot() = nb; std::cin.rdbuf(nb);\n' +
    '}\n' +
    'inline void reattach() { attach(); }\n' +
    'struct Init { Init() { std::cout << std::unitbuf; attach(); } } init;\n' +
    '}\n' +
    '#define sync_with_stdio(...) sync_with_stdio(__VA_ARGS__), ::lab_rt::reattach()\n'
  );
}

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
  /** false cuando el programa no lee por std::cin y la sesión no puede ser interactiva. */
  interactive: boolean;
  /** Motivo, cuando interactive es false y el alumno debería saberlo. */
  notice: string | null;
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
  /** Compila además el código tal cual, para que los errores sean los de verdad. */
  verify?: boolean;
  signal?: AbortSignal;
};

type Fetched = { ok: true; payload: GodboltResponse } | { ok: false; result: RunResult };

async function post(
  body: unknown,
  signal: AbortSignal | undefined,
  expectBuild = true,
): Promise<Fetched> {
  try {
    const response = await fetch(`${ENDPOINT}/${COMPILER}/compile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "User-Agent": USER_AGENT,
      },
      signal,
      body: JSON.stringify(body),
    });
    if (!response.ok) {
      return { ok: false, result: service(`El servicio de compilación respondió ${response.status}.`) };
    }
    const text = await response.text();
    let payload: GodboltResponse;
    try {
      payload = JSON.parse(text) as GodboltResponse;
    } catch {
      return {
        ok: false,
        result: service("El servicio de compilación devolvió una respuesta que no se pudo leer."),
      };
    }
    const shapeOk =
      payload && typeof payload === "object" && (!expectBuild || "buildResult" in payload);
    if (!shapeOk) {
      // Falla ruidosamente: un formato inesperado no puede parecer "todo bien".
      return {
        ok: false,
        result: service("El servicio de compilación cambió de formato: revisa la integración."),
      };
    }
    return { ok: true, payload };
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    if (aborted) {
      return {
        ok: false,
        result: {
          ...service("La compilación superó el límite de tiempo."),
          status: "timeout",
          statusLabel: "Tiempo de espera agotado",
          timedOut: true,
        },
      };
    }
    return { ok: false, result: service("No se pudo contactar con el servicio de compilación.") };
  }
}

function runBody(source: string, stdin: string) {
  return {
    source,
    lang: "c++",
    options: {
      userArguments: ARGS,
      executeParameters: { args: [], stdin },
      compilerOptions: { executorRequest: true, skipAsm: true },
      filters: { execute: true },
    },
  };
}

function compileOnlyBody(source: string) {
  return {
    source,
    lang: "c++",
    options: {
      userArguments: ARGS,
      compilerOptions: { skipAsm: true },
      filters: { execute: false },
    },
  };
}

export async function runCpp(code: string, stdin: string, options: RunOptions = {}): Promise<RunResult> {
  const wantsInteractive = (options.mode ?? "batch") === "interactive";
  const interactive = wantsInteractive && !BYPASSES_CIN.test(code);
  const notice =
    wantsInteractive && !interactive
      ? "Este programa lee la entrada sin usar std::cin (scanf, getchar, sync_with_stdio…), " +
        "así que la entrada se envía completa antes de ejecutar, desde la pestaña ENTRADA."
      : null;

  const mark = markToken();
  const head = prologue(mark);
  // Líneas que el prólogo pone por delante: lo que hay que restar para que los
  // mensajes del compilador citen las líneas del editor del alumno.
  const offset = head.split("\n").length - 1;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  const signal =
    options.signal && typeof AbortSignal.any === "function"
      ? AbortSignal.any([controller.signal, options.signal])
      : controller.signal;

  try {
    const [run, verification] = await Promise.all([
      post(runBody(head + code, stdin), signal),
      // El código tal cual: es el que dice la verdad sobre los #include que faltan.
      options.verify ? post(compileOnlyBody(code), signal, false) : Promise.resolve(null),
    ]);

    if (!run.ok) return { ...run.result, interactive, notice };
    const payload = run.payload;

    const build = payload.buildResult ?? {};
    let diagnostics = parseDiagnostics(build.stderr as never, offset);
    let compileOutput = remapCompilerOutput(
      [joinLines(build.stdout), joinLines(build.stderr)].filter(Boolean).join("\n"),
      offset,
    );
    let buildFailed = (build.code ?? 0) !== 0;

    // Sólo cuando el prólogo ha hecho compilar algo que por sí solo no compila
    // (típicamente por el <iostream> que él incluye) mandan los errores del
    // código tal cual: es lo que vería el alumno con g++ en su máquina.
    if (!buildFailed && verification && verification.ok) {
      const raw = verification.payload.buildResult ?? verification.payload;
      const rawFailed = (raw.code ?? 0) !== 0;
      if (rawFailed) {
        diagnostics = parseDiagnostics((raw.stderr ?? []) as never);
        compileOutput = remapCompilerOutput(
          [joinLines(raw.stdout as never), joinLines(raw.stderr as never)].filter(Boolean).join("\n"),
          0,
        );
        buildFailed = true;
      }
    }

    const { errors, warnings } = countBySeverity(diagnostics);

    if (buildFailed) {
      return {
        ...base(),
        status: "error_compilacion",
        statusLabel: "Error de compilación",
        compileOutput,
        diagnostics,
        errors,
        warnings,
        exitCode: build.code ?? 1,
        interactive,
        notice,
      };
    }

    const rawOut = joinLines(payload.stdout);
    const markIndex = rawOut.indexOf(mark);
    const truncated = Boolean(payload.truncated) || Boolean(build.truncated);
    const waitingForInput = markIndex !== -1;
    const stdoutFull = rawOut.split(mark).join("");
    const stdout = waitingForInput && interactive ? rawOut.slice(0, markIndex) : stdoutFull;

    const stderr = joinLines(payload.stderr);
    const exitCode = typeof payload.code === "number" ? payload.code : null;
    const timedOut = Boolean(payload.timedOut) || /processing time exceeded/i.test(stderr);
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
      interactive,
      notice: truncated
        ? "El programa escribió tanto que la salida se cortó: la sesión interactiva no puede continuar."
        : notice,
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
    // Con la salida cortada la marca puede haberse perdido: no se puede seguir
    // la sesión sin arriesgarse a mentir.
    if (waitingForInput && interactive && !truncated) {
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
  } finally {
    clearTimeout(timer);
  }
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
    interactive: true,
    notice: null,
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

/** Transcripción en texto plano de una ejecución suelta (modo lote). */
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
