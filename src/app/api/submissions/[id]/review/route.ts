import { authorizeProfessor } from "@/lib/auth";
import { getSubmission, reviewSubmission } from "@/lib/db";
import { fail, isUuid, json, readJson, serverError, str } from "@/lib/http";
import { LIMITS, NOTE_KINDS, normalizeStatus, sanitizeNotes } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/submissions/:id/review
 * Cabecera: Authorization: Bearer <contraseña del profesor>
 * Cuerpo:   { "status": "correcto" | "necesita_correccion" | "pendiente",
 *             "feedback": "...", "title": "opcional",
 *             "notes": [{ "line": 12, "kind": "error", "body": "..." }] }
 *
 * Omitir "notes" deja las notas como estaban; mandar [] las borra.
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const auth = await authorizeProfessor(request);
    if (!auth.ok) return fail(auth.message, auth.status);

    const { id } = await context.params;
    if (!isUuid(id)) return fail("El identificador no tiene forma de UUID.", 400);

    const status = normalizeStatus(body.status ?? body.reviewStatus);
    if (!status) {
      return fail('El campo "status" debe ser pendiente, correcto o necesita_correccion.');
    }

    const feedback = str(body.feedback);
    if (feedback.length > LIMITS.feedback) {
      return fail(`El feedback supera el máximo de ${LIMITS.feedback} caracteres.`, 413);
    }

    const title = str(body.title).trim().slice(0, LIMITS.title) || null;

    // Las notas se validan contra el código real de la entrega antes de escribir:
    // una línea fuera de rango se rechaza, no se recorta en silencio.
    let notes = null;
    if (body.notes !== undefined) {
      if (!Array.isArray(body.notes)) return fail('El campo "notes" debe ser una lista.');
      if (body.notes.length > LIMITS.notes) {
        return fail(`Como mucho ${LIMITS.notes} notas por entrega.`, 413);
      }
      const submission = await getSubmission(id);
      if (!submission) return fail("Entrega no encontrada.", 404);

      const totalLines = submission.code.split("\n").length;
      for (const raw of body.notes) {
        const note = raw as Record<string, unknown>;
        if (!note || typeof note !== "object") return fail("Cada nota debe ser un objeto.");
        const line = Number(note.line);
        if (!Number.isInteger(line) || line < 1 || line > totalLines) {
          return fail(
            `Cada nota necesita "line" entre 1 y ${totalLines} (las líneas del código entregado).`,
          );
        }
        const text = typeof note.body === "string" ? note.body.trim() : "";
        if (!text) return fail('Cada nota necesita "body" con texto.');
        if (text.length > LIMITS.noteBody) {
          return fail(`Una nota supera los ${LIMITS.noteBody} caracteres.`, 413);
        }
        if (note.kind !== undefined && !(NOTE_KINDS as readonly string[]).includes(String(note.kind))) {
          return fail('El campo "kind" debe ser error, sugerencia o elogio.');
        }
      }
      notes = sanitizeNotes(body.notes, submission.code);
    }

    const submission = await reviewSubmission({ id, status, feedback, title, notes, key: auth.key });
    if (!submission) return fail("Entrega no encontrada.", 404);
    return json({ submission });
  } catch (error) {
    return serverError(error);
  }
}
