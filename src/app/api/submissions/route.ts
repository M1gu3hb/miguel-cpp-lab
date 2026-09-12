import { createSubmission, listSubmissions } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";
import { LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/submissions — historial completo, de la más reciente a la más antigua. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const raw = Number(url.searchParams.get("limit") ?? "100");
    const limit = Number.isFinite(raw) ? Math.min(Math.max(Math.trunc(raw), 1), 500) : 100;
    const items = await listSubmissions(limit);
    return json({ count: items.length, items });
  } catch (error) {
    return serverError(error);
  }
}

/** POST /api/submissions — el alumno entrega. */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const code = str(body.code).trim();
    if (!code) return fail("El código no puede estar vacío.");
    if (code.length > LIMITS.code) {
      return fail(`El código supera el máximo de ${LIMITS.code} caracteres.`, 413);
    }

    const title = str(body.title).trim().slice(0, LIMITS.title) || "Ejercicio sin título";
    const stdin = str(body.stdin).slice(0, LIMITS.stdin);
    const compilerOutput = str(body.compilerOutput ?? body.compiler_output).slice(
      0,
      LIMITS.compilerOutput,
    );

    const submission = await createSubmission({ title, code, stdin, compilerOutput });
    return json({ submission }, 201);
  } catch (error) {
    return serverError(error);
  }
}
