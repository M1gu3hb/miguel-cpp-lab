import { authorizeProfessor } from "@/lib/auth";
import { reviewSubmission } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";
import { LIMITS, normalizeStatus } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/submissions/:id/review
 * Cabecera: Authorization: Bearer <PROFESSOR_KEY>
 * Cuerpo:   { "status": "correcto" | "necesita_correccion" | "pendiente", "feedback": "..." }
 */
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const auth = authorizeProfessor(request);
  if (!auth.ok) return fail(auth.message, auth.status);

  try {
    const { id } = await context.params;
    const body = await readJson(request);
    if (!body) return fail("El cuerpo debe ser JSON válido.");

    const status = normalizeStatus(body.status ?? body.reviewStatus);
    if (!status) {
      return fail('El campo "status" debe ser pendiente, correcto o necesita_correccion.');
    }

    const feedback = str(body.feedback);
    if (feedback.length > LIMITS.feedback) {
      return fail(`El feedback supera el máximo de ${LIMITS.feedback} caracteres.`, 413);
    }

    const submission = await reviewSubmission({ id, status, feedback, key: auth.key });
    if (!submission) return fail("Entrega no encontrada.", 404);
    return json({ submission });
  } catch (error) {
    return serverError(error);
  }
}
