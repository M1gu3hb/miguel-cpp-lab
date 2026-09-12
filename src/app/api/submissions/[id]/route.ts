import { getSubmission } from "@/lib/db";
import { fail, json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/submissions/:id — una entrega concreta. */
export async function GET(_request: Request, context: { params: Promise<{ id: string }> }) {
  try {
    const { id } = await context.params;
    const submission = await getSubmission(id);
    if (!submission) return fail("Entrega no encontrada.", 404);
    return json(submission);
  } catch (error) {
    return serverError(error);
  }
}
