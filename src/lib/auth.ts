import { checkProfessorKey } from "./db";

export function extractKey(request: Request): string | null {
  const header = request.headers.get("authorization");
  if (header?.toLowerCase().startsWith("bearer ")) return header.slice(7).trim();
  const direct = request.headers.get("x-professor-key");
  return direct ? direct.trim() : null;
}

export type AuthResult = { ok: true; key: string } | { ok: false; status: 401; message: string };

/**
 * Autoriza una petición de profesor. La clave no vive en el código ni en el
 * repositorio: la base guarda su hash y la verifica en una función
 * SECURITY DEFINER.
 */
export async function authorizeProfessor(request: Request): Promise<AuthResult> {
  const received = extractKey(request);
  if (!received) {
    return { ok: false, status: 401, message: "Falta la clave del profesor." };
  }
  const valid = await checkProfessorKey(received);
  if (!valid) {
    return { ok: false, status: 401, message: "Clave de profesor inválida." };
  }
  return { ok: true, key: received };
}
