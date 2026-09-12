import { authorizeProfessor } from "@/lib/auth";
import { fail, json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/professor/session — valida la clave del profesor. */
export async function POST(request: Request) {
  try {
    const auth = await authorizeProfessor(request);
    if (!auth.ok) return fail(auth.message, auth.status);
    return json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
