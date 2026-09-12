import { professorStatus } from "@/lib/db";
import { json, serverError } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** GET /api/professor/status — ¿hay clave dada de alta?, ¿está abierta el alta? */
export async function GET() {
  try {
    return json(await professorStatus());
  } catch (error) {
    return serverError(error);
  }
}
