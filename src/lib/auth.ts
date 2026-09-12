import { timingSafeEqual } from "node:crypto";
import { professorKey } from "./env";

/** Comparación en tiempo constante entre la clave recibida y la del entorno. */
function sameKey(received: string, expected: string): boolean {
  const a = Buffer.from(received, "utf8");
  const b = Buffer.from(expected, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export function extractKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const direct = request.headers.get("x-professor-key");
  return direct ? direct.trim() : null;
}

export type AuthResult =
  | { ok: true; key: string }
  | { ok: false; status: 401 | 503; message: string };

/**
 * Autoriza una petición de profesor. La clave vive en PROFESSOR_KEY (entorno de
 * Vercel): nunca en el código ni en el repositorio.
 */
export function authorizeProfessor(request: Request): AuthResult {
  let expected: string;
  try {
    expected = professorKey();
  } catch {
    return {
      ok: false,
      status: 503,
      message: "PROFESSOR_KEY no está configurada en el servidor.",
    };
  }

  const received = extractKey(request);
  if (!received || !sameKey(received, expected)) {
    return { ok: false, status: 401, message: "Clave de profesor inválida." };
  }
  return { ok: true, key: expected };
}
