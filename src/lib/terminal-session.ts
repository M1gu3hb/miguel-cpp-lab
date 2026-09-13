/**
 * Lógica pura de la sesión de terminal, sin React y sin DOM, para poder
 * razonarla (y probarla) aparte de la interfaz.
 *
 * El servicio de ejecución es de un solo disparo: no hay un proceso vivo al
 * otro lado. Lo que sostiene la ilusión de terminal es que el programa se
 * reejecuta con TODA la entrada acumulada y que el motor sabe, con precisión de
 * carácter, dónde el programa pidió entrada (ver el prólogo de run-cpp.ts).
 * Como la entrada nueva siempre es un superconjunto de la anterior, la salida
 * visible sólo puede crecer: de ahí que baste con pintar el trozo nuevo.
 */

export type SegmentKind = "cmd" | "out" | "err" | "echo" | "info" | "warn" | "status";

export type Segment = { kind: SegmentKind; text: string };

export type SessionPhase = "idle" | "running" | "waiting" | "done";

/**
 * Compara lo ya mostrado con la salida de la nueva ejecución.
 * `diverged` significa que el programa no repitió lo que ya había impreso: no
 * es reproducible (rand, time, memoria sin inicializar…).
 */
export function nextChunk(shown: string, fresh: string): { delta: string; diverged: boolean } {
  if (fresh.startsWith(shown)) return { delta: fresh.slice(shown.length), diverged: false };
  return { delta: fresh, diverged: true };
}

/** Lo que se manda como stdin tras N líneas tecleadas. */
export function stdinFrom(lines: string[]): string {
  return lines.length ? `${lines.join("\n")}\n` : "";
}

export function statusSegment(label: string, timeMs: number | null): Segment {
  const time = timeMs != null ? ` · ${timeMs} ms` : "";
  return { kind: "status", text: `\n[${label}${time}]\n` };
}
