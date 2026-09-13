export const REVIEW_STATUSES = ["pendiente", "correcto", "necesita_correccion"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

export const NOTE_KINDS = ["error", "sugerencia", "elogio"] as const;

export type NoteKind = (typeof NOTE_KINDS)[number];

/** Nota del profesor anclada a una línea concreta del código entregado. */
export type ReviewNote = {
  id: string;
  line: number;
  kind: NoteKind;
  body: string;
  createdAt: string;
};

/** Forma pública de una entrega: la que devuelve la API y consume la interfaz. */
export type Submission = {
  id: string;
  title: string;
  code: string;
  stdin: string;
  compilerOutput: string;
  createdAt: string;
  reviewStatus: ReviewStatus;
  feedback: string;
  reviewNotes: ReviewNote[];
  reviewedAt: string | null;
};

export type SubmissionRow = {
  id: string;
  title: string;
  code: string;
  stdin: string;
  compiler_output: string;
  created_at: string;
  review_status: ReviewStatus;
  feedback: string;
  review_notes: unknown;
  reviewed_at: string | null;
};

export const LIMITS = {
  code: 100_000,
  stdin: 20_000,
  title: 200,
  compilerOutput: 100_000,
  feedback: 20_000,
  notes: 50,
  noteBody: 2_000,
};

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pendiente: "Pendiente de revisión",
  correcto: "Correcto",
  necesita_correccion: "Necesita corrección",
};

export const NOTE_LABELS: Record<NoteKind, string> = {
  error: "Corrige esto",
  sugerencia: "Se puede mejorar",
  elogio: "Bien hecho",
};

const STATUS_ALIASES: Record<string, ReviewStatus> = {
  pendiente: "pendiente",
  pending: "pendiente",
  correcto: "correcto",
  correct: "correcto",
  ok: "correcto",
  necesita_correccion: "necesita_correccion",
  "necesita-correccion": "necesita_correccion",
  "necesita correccion": "necesita_correccion",
  "necesita corrección": "necesita_correccion",
  needs_fix: "necesita_correccion",
};

/** Acepta las variantes razonables que puede mandar un agente externo. */
export function normalizeStatus(value: unknown): ReviewStatus | null {
  if (typeof value !== "string") return null;
  return STATUS_ALIASES[value.trim().toLowerCase()] ?? null;
}

export function toSubmission(row: SubmissionRow): Submission {
  return {
    id: row.id,
    title: row.title,
    code: row.code,
    stdin: row.stdin,
    compilerOutput: row.compiler_output,
    createdAt: new Date(row.created_at).toISOString(),
    reviewStatus: row.review_status,
    feedback: row.feedback,
    reviewNotes: sanitizeNotes(row.review_notes, row.code),
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
  };
}

/**
 * Saneador de notas: nunca lanza. Una fila con JSON raro pierde esa nota, no la
 * lista entera ni la página.
 */
export function sanitizeNotes(raw: unknown, code: string): ReviewNote[] {
  if (!Array.isArray(raw)) return [];
  const totalLines = code ? code.split("\n").length : 1;
  const ids = new Set<string>();
  const notes: ReviewNote[] = [];

  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Record<string, unknown>;

    const line = Number(candidate.line);
    if (!Number.isFinite(line)) continue;
    const clamped = Math.min(Math.max(Math.trunc(line), 1), totalLines);

    const body = typeof candidate.body === "string" ? candidate.body.trim() : "";
    if (!body) continue;

    const kindRaw = typeof candidate.kind === "string" ? candidate.kind : "error";
    const kind = (NOTE_KINDS as readonly string[]).includes(kindRaw)
      ? (kindRaw as NoteKind)
      : "error";

    let id = typeof candidate.id === "string" && candidate.id ? candidate.id.slice(0, 40) : "";
    if (!id || ids.has(id)) id = `n_${notes.length}_${clamped}`;
    ids.add(id);

    const createdAt =
      typeof candidate.createdAt === "string" && !Number.isNaN(Date.parse(candidate.createdAt))
        ? new Date(candidate.createdAt).toISOString()
        : new Date(0).toISOString();

    notes.push({ id, line: clamped, kind, body: body.slice(0, LIMITS.noteBody), createdAt });
    if (notes.length >= LIMITS.notes) break;
  }

  // Orden estable: por línea y, dentro de una línea, por antigüedad.
  return notes.sort((a, b) => a.line - b.line || a.createdAt.localeCompare(b.createdAt));
}
