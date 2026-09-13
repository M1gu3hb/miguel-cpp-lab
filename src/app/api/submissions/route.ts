import { createSubmission, listSubmissions } from "@/lib/db";
import { clip, fail, json, readJson, serverError, str } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";
import { LIMITS } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/submissions — historial completo, de la más reciente a la más antigua. */
export async function GET(request: Request) {
  try {
    const url = new URL(request.url);
    const rawParam = (url.searchParams.get("limit") ?? "").trim();
    const raw = rawParam ? Number(rawParam) : 100;
    const limit = Number.isFinite(raw) && raw > 0 ? Math.min(Math.trunc(raw), 500) : 100;
    const items = await listSubmissions(limit);
    return json({ count: items.length, items });
  } catch (error) {
    return serverError(error);
  }
}

/** POST /api/submissions — el alumno entrega. */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request, "submit"), 20, 60_000);
    if (!limit.ok) {
      return fail(`Demasiadas entregas seguidas. Prueba en ${limit.retryAfter} s.`, 429);
    }

    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const code = str(body.code).trim();
    if (!code) return fail("El código no puede estar vacío.");
    if (code.length > LIMITS.code) {
      return fail(`El código supera el máximo de ${LIMITS.code} caracteres.`, 413);
    }

    const title = clip(str(body.title).trim(), LIMITS.title) || "Ejercicio sin título";
    const stdin = clip(str(body.stdin), LIMITS.stdin);
    const compilerOutput = clip(str(body.compilerOutput ?? body.compiler_output), LIMITS.compilerOutput);

    const submission = await createSubmission({ title, code, stdin, compilerOutput });
    return json({ submission }, 201);
  } catch (error) {
    return serverError(error);
  }
}
