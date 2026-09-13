import { authorizeProfessor } from "@/lib/auth";
import { getSubmission, reviewSubmission } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";
import { LIMITS, normalizeStatus, sanitizeNotes } from "@/lib/types";

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
    const status = normalizeStatus(body.status ?? body.reviewStatus);
    if (!status) {
      return fail('El campo "status" debe ser pendiente, correcto o necesita_correccion.');
    }

    const feedback = str(body.feedback);
    if (feedback.length > LIMITS.feedback) {
      return fail(`El feedback supera el máximo de ${LIMITS.feedback} caracteres.`, 413);
    }

    const title = str(body.title).trim().slice(0, LIMITS.title) || null;

    // Las notas se validan contra el código real de la entrega antes de escribir.
    let notes = null;
    if (body.notes !== undefined) {
      if (!Array.isArray(body.notes)) return fail('El campo "notes" debe ser una lista.');
      const submission = await getSubmission(id);
      if (!submission) return fail("Entrega no encontrada.", 404);
      notes = sanitizeNotes(body.notes, submission.code);
      if (notes.length !== body.notes.length) {
        return fail(
          "Alguna nota no es válida: necesita line (dentro del código) y body (1-2000 caracteres).",
        );
      }
    }

    const submission = await reviewSubmission({ id, status, feedback, title, notes, key: auth.key });
    if (!submission) return fail("Entrega no encontrada.", 404);
    return json({ submission });
  } catch (error) {
    return serverError(error);
  }
}
