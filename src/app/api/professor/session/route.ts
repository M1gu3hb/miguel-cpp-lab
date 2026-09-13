import { authorizeProfessor } from "@/lib/auth";
import { fail, json, serverError } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/professor/session — valida la clave del profesor. */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request, "clave"), 10, 60_000);
    if (!limit.ok) {
      return fail(`Demasiados intentos. Prueba en ${limit.retryAfter} s.`, 429);
    }

    const auth = await authorizeProfessor(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    return json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
