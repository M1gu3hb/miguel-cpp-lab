import { clip, fail, json, readJson, serverError, str } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { formatRunResult, runCpp } from "@/lib/run-cpp";
import { LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

/**
 * POST /api/run — compila y ejecuta C++ de verdad.
 * { code, stdin, mode?: "interactive" | "batch" }
 *
 * En modo "interactive" la salida se corta en el punto exacto en el que el
 * programa pide entrada; en "batch" se devuelve la ejecución completa.
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request, "run"), 40, 60_000);
    if (!limit.ok) {
      return fail(`Demasiadas ejecuciones seguidas. Prueba en ${limit.retryAfter} s.`, 429);
    }

    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const code = str(body.code);
    if (!code.trim()) return fail("No hay código para compilar.");
    if (code.length > LIMITS.code) {
      return fail(`El código supera el máximo de ${LIMITS.code} caracteres.`, 413);
    }

    const stdin = clip(str(body.stdin), LIMITS.stdin);
    const mode = body.mode === "interactive" ? "interactive" : "batch";
    // La verificación (compilar también el código sin el prólogo) sólo hace
    // falta al empezar: dentro de una sesión el código no cambia.
    const verify = body.verify !== false && (mode === "batch" || !stdin);

    const result = await runCpp(code, stdin, { mode, verify, signal: request.signal });
    return json({ ...result, console: formatRunResult(result) });
  } catch (error) {
    return serverError(error);
  }
}
