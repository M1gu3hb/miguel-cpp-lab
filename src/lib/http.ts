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
  return json({ error: message }, 500);
}

export async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body = await request.json();
    return body && typeof body === "object" ? (body as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

export function str(value: unknown, fallback = ""): string {
  return typeof value === "string" ? value : fallback;
}
