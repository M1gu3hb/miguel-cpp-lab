export const REVIEW_STATUSES = ["pendiente", "correcto", "necesita_correccion"] as const;

export type ReviewStatus = (typeof REVIEW_STATUSES)[number];

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
  reviewed_at: string | null;
};

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
    reviewedAt: row.reviewed_at ? new Date(row.reviewed_at).toISOString() : null,
  };
}

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
  const key = value.trim().toLowerCase();
  return STATUS_ALIASES[key] ?? null;
}

export const STATUS_LABELS: Record<ReviewStatus, string> = {
  pendiente: "Pendiente de revisión",
  correcto: "Correcto",
  necesita_correccion: "Necesita corrección",
};

export const LIMITS = {
  code: 100_000,
  stdin: 20_000,
  title: 200,
  compilerOutput: 100_000,
  feedback: 20_000,
};
