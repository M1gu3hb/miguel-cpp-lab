/**
 * Configuración del servidor. Ningún valor de aquí llega al navegador:
 * todo se lee dentro de route handlers.
 */
export function supabaseConfig() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    throw new ConfigError(
      "Faltan SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY en las variables de entorno.",
    );
  }
  return { url, key };
}

export function professorKey(): string {
  const key = process.env.PROFESSOR_KEY;
  if (!key || key.length < 12) {
    throw new ConfigError(
      "PROFESSOR_KEY no está configurada (o tiene menos de 12 caracteres).",
    );
  }
  return key;
}

export function configStatus() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const prof = process.env.PROFESSOR_KEY;
  return {
    supabaseUrl: Boolean(url),
    supabaseKey: Boolean(key),
    professorKey: Boolean(prof && prof.length >= 12),
  };
}

export class ConfigError extends Error {}
