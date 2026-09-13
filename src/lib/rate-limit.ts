/**
 * Límite de peticiones, en memoria del proceso.
 *
 * No es una defensa seria contra un atacante decidido: en serverless hay varias
 * instancias y cada arranque en frío empieza de cero. Lo que sí evita, y por eso
 * está aquí, es que un bucle accidental o un script curioso conviertan esta app
 * en un grifo abierto hacia el compilador o en un martillo contra la contraseña
 * del profesor.
 */
type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
const MAX_KEYS = 5_000;

export type RateResult = { ok: boolean; retryAfter: number };

export function rateLimit(key: string, limit: number, windowMs: number): RateResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    if (buckets.size > MAX_KEYS) buckets.clear();
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, retryAfter: 0 };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, retryAfter: Math.ceil((bucket.resetAt - now) / 1000) };
  }
  return { ok: true, retryAfter: 0 };
}

/** Identidad aproximada del cliente, sólo para contar peticiones. */
export function clientKey(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for") ?? "";
  const ip = forwarded.split(",")[0].trim() || request.headers.get("x-real-ip") || "desconocido";
  return `${scope}:${ip}`;
}
