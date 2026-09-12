import { setProfessorKey } from "@/lib/db";
import { fail, json, readJson, serverError, str } from "@/lib/http";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * POST /api/professor/setup — da de alta la clave del profesor.
 * Sólo funciona si todavía no hay clave y la ventana de alta está abierta
 * (se abre desde la consola de Supabase: select cpp_lab_open_setup_window(30)).
 */
export async function POST(request: Request) {
  try {
    const body = await readJson(request);
    const key = str(body?.key).trim();
    if (key.length < 8) return fail("La clave debe tener al menos 8 caracteres.");

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
    if (message.includes("al menos 8")) return fail("La clave debe tener al menos 8 caracteres.");
    return serverError(error);
  }
}
