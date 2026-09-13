import { setProfessorKey } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";
import { clientKey, rateLimit } from "@/lib/rate-limit";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/professor/setup — da de alta la clave del profesor.
 * Sólo funciona si todavía no hay clave y la ventana de alta está abierta
 * (se abre desde la consola de Supabase: select cpp_lab_open_setup_window(30)).
 */
export async function POST(request: Request) {
  try {
    const limit = rateLimit(clientKey(request, "clave"), 10, 60_000);
    if (!limit.ok) {
      return fail(`Demasiados intentos. Prueba en ${limit.retryAfter} s.`, 429);
    }

    const body = await readJson(request);
    const key = str(body?.key).trim();
    if (key.length < 10) return fail("La clave debe tener al menos 10 caracteres.");

    await setProfessorKey(key);
    return json({ ok: true });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error inesperado.";
    if (message.includes("ya existe una clave")) {
      return fail("Ya hay una clave dada de alta. Usa /api/professor/rotate para cambiarla.", 409);
    }
    if (message.includes("no esta abierta")) {
      return fail(
        "El alta de la clave está cerrada. Ábrela desde Supabase con " +
          "select cpp_lab_open_setup_window(30);",
        403,
      );
    }
    if (message.includes("al menos 10")) return fail("La clave debe tener al menos 10 caracteres.");
    return serverError(error);
  }
}
