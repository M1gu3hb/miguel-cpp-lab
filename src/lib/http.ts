import { NextResponse } from "next/server";
import { ConfigError } from "./env";

export function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { "Cache-Control": "no-store" },
  });
}

export function fail(message: string, status = 400, extra?: Record<string, unknown>) {
  return json({ error: message, ...extra }, status);
}

export function serverError(error: unknown) {
  const message = error instanceof Error ? error.message : "Error inesperado.";
  // Falta configuración: no es un fallo del código, es un despliegue a medio hacer.
  if (error instanceof ConfigError) return json({ error: message, code: "config" }, 503);
  // El detalle (que puede nombrar tablas, roles o permisos) va al registro del
  // servidor; al cliente sólo le llega que la operación falló.
  console.error("[miguel-cpp-lab]", message);
  return json({ error: "No se pudo completar la operación. Vuelve a intentarlo." }, 500);
}

/** Recorta sin partir un par suplente (emojis y demás caracteres largos). */
export function clip(value: string, max: number): string {
  if (value.length <= max) return value;
  const cut = value.slice(0, max);
  const last = cut.charCodeAt(cut.length - 1);
  return last >= 0xd800 && last <= 0xdbff ? cut.slice(0, -1) : cut;
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/**
 * PostgreSQL no admite el carácter NUL dentro de un texto: si se cuela, la
 * escritura falla con un 500 que no explica nada. Se limpia en la puerta.
 */
export function str(value: unknown, fallback = ""): string {
  if (typeof value !== "string") return fallback;
  return value.replace(/\u0000/g, "");
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isUuid(value: string): boolean {
  return UUID.test(value);
}
