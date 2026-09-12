/**
 * Configuración del servidor. Sale de variables de entorno y nunca del código:
 * en este repositorio no hay claves. Todo se lee dentro de route handlers, así
 * que nada de esto llega al navegador.
 */
export class ConfigError extends Error {}

function read() {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key =
    process.env.SUPABASE_PUBLISHABLE_KEY ??
    process.env.SUPABASE_ANON_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ??
    "";
  return { url, key };
}

export function supabaseConfig() {
  const { url, key } = read();
  if (!url || !key) {
    throw new ConfigError(
      "Faltan SUPABASE_URL y/o SUPABASE_PUBLISHABLE_KEY en las variables de entorno.",
    );
  }
  return { url, key };
}

export function configStatus() {
  const { url, key } = read();
  return { supabaseUrl: Boolean(url), supabaseKey: Boolean(key) };
}
