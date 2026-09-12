import { getLatestSubmission } from "@/lib/db";
import { json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/submissions/latest — la última entrega, para consulta automatizada. */
export async function GET() {
  try {
    const submission = await getLatestSubmission();
    if (!submission) {
      return json({ error: "Todavía no hay entregas.", submission: null }, 404);
    }
    return json(submission);
  } catch (error) {
    return serverError(error);
  }
}
