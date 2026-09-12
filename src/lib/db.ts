import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseConfig } from "./env";
import { toSubmission, type ReviewStatus, type Submission, type SubmissionRow } from "./types";

const COLUMNS =
  "id,title,code,stdin,compiler_output,created_at,review_status,feedback,reviewed_at";

let client: SupabaseClient | null = null;

function db(): SupabaseClient {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
      global: { headers: { "x-application-name": "miguel-cpp-lab" } },
    });
  }
  return client;
}

export async function listSubmissions(limit = 100): Promise<Submission[]> {
  const { data, error } = await db()
    .from("cpp_lab_submissions")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error) throw new Error(`No se pudieron leer las entregas: ${error.message}`);
  return (data as SubmissionRow[]).map(toSubmission);
}

export async function getSubmission(id: string): Promise<Submission | null> {
  const { data, error } = await db()
    .from("cpp_lab_submissions")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la entrega: ${error.message}`);
  return data ? toSubmission(data as SubmissionRow) : null;
}

export async function getLatestSubmission(): Promise<Submission | null> {
  const { data, error } = await db()
    .from("cpp_lab_submissions")
    .select(COLUMNS)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw new Error(`No se pudo leer la última entrega: ${error.message}`);
  return data ? toSubmission(data as SubmissionRow) : null;
}

export async function createSubmission(input: {
  title: string;
  code: string;
  stdin: string;
  compilerOutput: string;
}): Promise<Submission> {
  const { data, error } = await db()
    .from("cpp_lab_submissions")
    .insert({
      title: input.title,
      code: input.code,
      stdin: input.stdin,
      compiler_output: input.compilerOutput,
    })
    .select(COLUMNS)
    .maybeSingle();

  if (error) throw new Error(`No se pudo guardar la entrega: ${error.message}`);
  if (!data) throw new Error("No se pudo guardar la entrega: la base no devolvió la fila.");
  return toSubmission(data as SubmissionRow);
}

/**
 * La revisión pasa por una función SECURITY DEFINER que exige la clave del
 * profesor: el rol anónimo no tiene UPDATE sobre la tabla.
 */
export async function reviewSubmission(args: {
  id: string;
  status: ReviewStatus;
  feedback: string;
  title?: string | null;
  key: string;
}): Promise<Submission | null> {
  const { data, error } = await db().rpc("cpp_lab_review_submission", {
    p_id: args.id,
    p_status: args.status,
    p_feedback: args.feedback,
    p_title: args.title ?? null,
    p_key: args.key,
  });

  if (error) throw new Error(`No se pudo guardar la revisión: ${error.message}`);
  const rows = (data ?? []) as SubmissionRow[];
  return rows.length ? toSubmission(rows[0]) : null;
}

/** Comprueba la clave contra la base (y la enlaza en el primer uso). */
export async function checkProfessorKey(key: string): Promise<boolean> {
  const { data, error } = await db().rpc("cpp_lab_check_professor_key", { p_key: key });
  if (error) throw new Error(`No se pudo verificar la clave: ${error.message}`);
  return data === true;
}

/** Estado del alta: si ya hay clave y si la ventana de alta sigue abierta. */
export async function professorStatus(): Promise<{ bound: boolean; setupOpen: boolean }> {
  const { data, error } = await db().rpc("cpp_lab_professor_status");
  if (error) throw new Error(`No se pudo leer el estado del acceso: ${error.message}`);
  return data as { bound: boolean; setupOpen: boolean };
}

/** Da de alta la clave del profesor (sólo con la ventana de alta abierta). */
export async function setProfessorKey(key: string): Promise<boolean> {
  const { data, error } = await db().rpc("cpp_lab_set_professor_key", { p_key: key });
  if (error) throw new Error(error.message);
  return data === true;
}

export async function rotateProfessorKey(current: string, next: string): Promise<boolean> {
  const { data, error } = await db().rpc("cpp_lab_rotate_professor_key", {
    p_current: current,
    p_new: next,
  });
  if (error) throw new Error(`No se pudo rotar la clave: ${error.message}`);
  return data === true;
}
