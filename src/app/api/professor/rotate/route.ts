import { extractKey } from "@/lib/auth";
import { rotateProfessorKey } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/professor/rotate — cambia la clave del profesor.
 * Cabecera: Authorization: Bearer <clave actual>
 * Cuerpo:   { "newKey": "<clave nueva>" }
 */
export async function POST(request: Request) {
  try {
    const current = extractKey(request);
    if (!current) return fail("Falta la clave actual en la cabecera Authorization.", 401);

    const body = await readJson(request);
    const next = str(body?.newKey ?? body?.key).trim();
    if (next.length < 8) return fail("La clave nueva debe tener al menos 8 caracteres.");

    await rotateProfessorKey(current, next);
    return json({ ok: true, message: "Clave actualizada." });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    if (message.includes("incorrecta")) return fail("Clave actual incorrecta.", 401);
    if (message.includes("al menos")) return fail("La clave nueva debe tener al menos 8 caracteres.");
    return serverError(error);
  }
}
