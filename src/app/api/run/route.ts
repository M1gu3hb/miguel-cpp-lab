import { fail, json, readJson, serverError, str } from "@/lib/http";
import { formatRunResult, runCpp } from "@/lib/run-cpp";
import { LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/** POST /api/run — compila y ejecuta C++ de verdad. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const code = str(body.code);
    if (!code.trim()) return fail("No hay código para compilar.");
    if (code.length > LIMITS.code) {
      return fail(`El código supera el máximo de ${LIMITS.code} caracteres.`, 413);
    }

    const stdin = str(body.stdin).slice(0, LIMITS.stdin);
    const result = await runCpp(code, stdin);
    return json({ ...result, console: formatRunResult(result) });
  } catch (error) {
    return serverError(error);
  }
}
