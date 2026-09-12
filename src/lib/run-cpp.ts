/**
 * Ejecución real de C++ contra el servicio público de Compiler Explorer
 * (godbolt.org). No se simula nada: lo que se muestra en consola es lo que
 * devolvió g++.
 */
const COMPILER = process.env.CPP_COMPILER_ID ?? "g132"; // GCC 13.2
const COMPILER_LABEL = process.env.CPP_COMPILER_LABEL ?? "g++ 13.2 · -std=c++17";
const ARGS = process.env.CPP_COMPILER_ARGS ?? "-std=c++17 -O1 -Wall";
const ENDPOINT = "https://godbolt.org/api/compiler";
const REQUEST_TIMEOUT_MS = 25_000;
const MAX_OUTPUT = 60_000;

export type RunStatus = "ok" | "error_compilacion" | "error_ejecucion" | "timeout" | "servicio";

export type RunResult = {
  status: RunStatus;
  statusLabel: string;
  compileOutput: string;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  timedOut: boolean;
  timeMs: number | null;
  compiler: string;
};

type GodboltLine = { text?: string };
type GodboltResponse = {
  code?: number;
  didExecute?: boolean;
  timedOut?: boolean;
  execTime?: number | string;
  stdout?: GodboltLine[];
  stderr?: GodboltLine[];
  buildResult?: {
    code?: number;
    timedOut?: boolean;
    stdout?: GodboltLine[];
    stderr?: GodboltLine[];
  };
};

// g++ colorea los diagnósticos; las secuencias ANSI no aportan nada en la consola web.
const ANSI = new RegExp(`${String.fromCharCode(27)}\\[[0-9;]*[a-zA-Z]`, "g");

function text(lines: GodboltLine[] | undefined): string {
  if (!lines?.length) return "";
  const joined = lines
    .map((line) => line.text ?? "")
    .join("\n")
    .replace(ANSI, "");
  return joined.length > MAX_OUTPUT
    ? `${joined.slice(0, MAX_OUTPUT)}\n… (salida truncada)`
    : joined;
}

export async function runCpp(code: string, stdin: string): Promise<RunResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  let payload: GodboltResponse;
  try {
    const response = await fetch(`${ENDPOINT}/${COMPILER}/compile`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      signal: controller.signal,
      body: JSON.stringify({
        source: code,
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
    payload = (await response.json()) as GodboltResponse;
  } catch (error) {
    const aborted = error instanceof Error && error.name === "AbortError";
    return aborted
      ? {
          status: "timeout",
          statusLabel: "Tiempo de espera agotado",
          compileOutput: "",
          stdout: "",
          stderr: "La compilación o la ejecución superaron el límite de tiempo.",
          exitCode: null,
          timedOut: true,
          timeMs: null,
          compiler: COMPILER_LABEL,
        }
      : service("No se pudo contactar con el servicio de compilación.");
  } finally {
    clearTimeout(timer);
  }

  const build = payload.buildResult ?? {};
  const compileOutput = [text(build.stdout), text(build.stderr)].filter(Boolean).join("\n");

  if ((build.code ?? 0) !== 0) {
    return {
      status: "error_compilacion",
      statusLabel: "Error de compilación",
      compileOutput,
      stdout: "",
      stderr: "",
      exitCode: build.code ?? null,
      timedOut: Boolean(build.timedOut),
      timeMs: null,
      compiler: COMPILER_LABEL,
    };
  }

  const exitCode = typeof payload.code === "number" ? payload.code : null;
  const timedOut = Boolean(payload.timedOut);
  const rawTime = payload.execTime != null ? Number(payload.execTime) : null;
  const timeMs = rawTime != null && Number.isFinite(rawTime) ? rawTime : null;

  if (timedOut) {
    return {
      status: "timeout",
      statusLabel: "Tiempo de ejecución agotado",
      compileOutput,
      stdout: text(payload.stdout),
      stderr: text(payload.stderr),
      exitCode,
      timedOut: true,
      timeMs,
      compiler: COMPILER_LABEL,
    };
  }

  const failed = exitCode !== 0;
  return {
    status: failed ? "error_ejecucion" : "ok",
    statusLabel: failed
      ? `El programa terminó con código ${exitCode}`
      : "Ejecución completada (código 0)",
    compileOutput,
    stdout: text(payload.stdout),
    stderr: text(payload.stderr),
    exitCode,
    timedOut: false,
    timeMs,
    compiler: COMPILER_LABEL,
  };
}

function service(message: string): RunResult {
  return {
    status: "servicio",
    statusLabel: "Servicio de compilación no disponible",
    compileOutput: "",
    stdout: "",
    stderr: message,
    exitCode: null,
    timedOut: false,
    timeMs: null,
    compiler: COMPILER_LABEL,
  };
}

/** Texto plano para la consola y para guardar junto a la entrega. */
export function formatRunResult(result: RunResult): string {
  const blocks = [
    `Estado: ${result.statusLabel}`,
    result.compileOutput ? `Compilador:\n${result.compileOutput}` : "",
    result.stderr ? `Errores:\n${result.stderr}` : "",
    result.stdout ? `Salida:\n${result.stdout}` : "",
  ].filter(Boolean);

  if (result.status === "ok" && !result.stdout) {
    blocks.push("(el programa no escribió nada en la salida estándar)");
  }
  return blocks.join("\n\n");
}
