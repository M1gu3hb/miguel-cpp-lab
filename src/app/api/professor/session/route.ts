import { authorizeProfessor } from "@/lib/auth";
import { checkProfessorKey } from "@/lib/db";
import { fail, json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** POST /api/professor/session — valida la clave del profesor. */
export async function POST(request: Request) {
  const auth = authorizeProfessor(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  try {
    const bound = await checkProfessorKey(auth.key);
    if (!bound) {
      return fail(
        "La clave del entorno no coincide con la registrada en la base de datos. " +
          "Usa POST /api/professor/rotate con la clave anterior para actualizarla.",
        409,
      );
    }
    return json({ ok: true });
  } catch (error) {
    return serverError(error);
  }
}
