-- Notas del profesor ancladas a líneas concretas del código entregado.
-- (Aplicada como cpp_lab_line_notes + cpp_lab_review_notes; esta es la forma final.)

drop policy if exists cpp_lab_submissions_insert_anon on public.cpp_lab_submissions;
drop policy if exists cpp_lab_submissions_insert_auth on public.cpp_lab_submissions;

alter table public.cpp_lab_submissions
  add column if not exists review_notes jsonb not null default '[]'::jsonb;

alter table public.cpp_lab_submissions
  drop constraint if exists cpp_lab_submissions_notes_chk;
alter table public.cpp_lab_submissions
  add constraint cpp_lab_submissions_notes_chk
  check (
    jsonb_typeof(review_notes) = 'array'
    and jsonb_array_length(review_notes) <= 50
    and length(review_notes::text) <= 40000
  );

comment on column public.cpp_lab_submissions.review_notes is
  'Notas del profesor ancladas a líneas del código: [{id,line,kind,body,createdAt}].
   Sólo las escribe cpp_lab_review_submission.';

create policy cpp_lab_submissions_insert_anon
  on public.cpp_lab_submissions for insert to anon
  with check (
    review_status = 'pendiente' and feedback = '' and reviewed_at is null
    and review_notes = '[]'::jsonb
  );
create policy cpp_lab_submissions_insert_auth
  on public.cpp_lab_submissions for insert to authenticated
  with check (
    review_status = 'pendiente' and feedback = '' and reviewed_at is null
    and review_notes = '[]'::jsonb
  );

drop function if exists public.cpp_lab_review_submission(uuid, text, text, text, text);

create or replace function public.cpp_lab_review_submission(
  p_id uuid, p_status text, p_feedback text, p_title text, p_key text,
  p_notes jsonb default null
)
returns setof public.cpp_lab_submissions
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_lines int;
begin
  if not public.cpp_lab_check_professor_key(p_key) then
    raise exception 'clave de profesor incorrecta' using errcode = '28000';
  end if;
  if p_status not in ('pendiente', 'correcto', 'necesita_correccion') then
    raise exception 'estado de revisión inválido' using errcode = '22023';
  end if;
  if p_feedback is not null and length(p_feedback) > 20000 then
    raise exception 'feedback demasiado largo' using errcode = '22023';
  end if;
  if p_title is not null and (length(btrim(p_title)) = 0 or length(p_title) > 200) then
    raise exception 'título inválido' using errcode = '22023';
  end if;

  -- p_notes null = no tocar las notas. '[]' = borrarlas todas.
  if p_notes is not null then
    if jsonb_typeof(p_notes) <> 'array' then
      raise exception 'las notas deben ser un arreglo' using errcode = '22023';
    end if;
    if jsonb_array_length(p_notes) > 50 then
      raise exception 'demasiadas notas (máximo 50)' using errcode = '22023';
    end if;
    if length(p_notes::text) > 40000 then
      raise exception 'las notas ocupan demasiado' using errcode = '22023';
    end if;

    select array_length(string_to_array(code, E'\n'), 1) into v_lines
      from public.cpp_lab_submissions where id = p_id;

    -- coalesce en cada comparación: sin él, una clave ausente da NULL y se cuela.
    if exists (
      select 1 from jsonb_array_elements(p_notes) as n
       where coalesce(jsonb_typeof(n.value), 'null') <> 'object'
          or coalesce(jsonb_typeof(n.value -> 'line'), 'null') <> 'number'
          or coalesce((n.value ->> 'line')::numeric, 0) <> trunc(coalesce((n.value ->> 'line')::numeric, 0.5))
          or coalesce((n.value ->> 'line')::numeric, 0) < 1
          or (v_lines is not null and coalesce((n.value ->> 'line')::numeric, 0) > v_lines)
          or coalesce(btrim(n.value ->> 'body'), '') = ''
          or coalesce(length(n.value ->> 'body'), 0) > 2000
          or coalesce(n.value ->> 'kind', 'error') not in ('error', 'sugerencia', 'elogio')
          or coalesce(length(n.value ->> 'id'), 0) > 40
    ) then
      raise exception 'nota inválida: revisa line, body y kind' using errcode = '22023';
    end if;
  end if;

  return query
    update public.cpp_lab_submissions
       set review_status = p_status,
           feedback      = coalesce(p_feedback, ''),
           title         = coalesce(nullif(btrim(p_title), ''), title),
           review_notes  = coalesce(p_notes, review_notes),
           reviewed_at   = now()
     where id = p_id
    returning *;
end $fn$;

revoke all on function public.cpp_lab_review_submission(uuid, text, text, text, text, jsonb) from public;
grant execute on function public.cpp_lab_review_submission(uuid, text, text, text, text, jsonb) to anon, authenticated;

do $$
begin
  if has_table_privilege('anon', 'public.cpp_lab_submissions', 'UPDATE') then
    raise exception 'anon no debe poder actualizar entregas';
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- Correcciones posteriores (aplicadas como cpp_lab_review_partial_updates y
-- cpp_lab_insert_columns_and_bcrypt_cost):
--
--   * feedback null = "no tocar" (omitirlo en una revisión ya no lo borraba).
--   * El rol anónimo sólo puede rellenar title, code, stdin y compiler_output:
--     no puede forjar id, created_at ni el estado de revisión.
--   * bcrypt con coste 11 y contraseña mínima de 10 caracteres.
-- ---------------------------------------------------------------------------

revoke insert on table public.cpp_lab_submissions from anon, authenticated;
grant insert (title, code, stdin, compiler_output)
  on table public.cpp_lab_submissions to anon, authenticated;
