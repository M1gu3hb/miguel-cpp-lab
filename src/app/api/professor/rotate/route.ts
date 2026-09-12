import { extractKey } from "@/lib/auth";
import { rotateProfessorKey } from "@/lib/db";
import { fail, json, serverError } from "@/lib/http";
import { ConfigError, professorKey } from "@/lib/env";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/professor/rotate
 * Cabecera: Authorization: Bearer <clave ANTERIOR, la registrada en la base>
 * Instala como clave vigente el valor actual de PROFESSOR_KEY.
 */
export async function POST(request: Request) {
  let next: string;
  try {
    next = professorKey();
  } catch (error) {
    if (error instanceof ConfigError) return fail(error.message, 503);
    return serverError(error);
  }

  const current = extractKey(request);
  if (!current) return fail("Falta la clave anterior en la cabecera Authorization.", 401);

  try {
    await rotateProfessorKey(current, next);
    return json({ ok: true, message: "La clave de PROFESSOR_KEY quedó registrada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    if (message.includes("incorrecta")) return fail("Clave anterior incorrecta.", 401);
    return serverError(error);
  }
}
