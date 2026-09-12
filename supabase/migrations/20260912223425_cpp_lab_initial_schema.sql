-- miguel-cpp-lab · esquema inicial
-- Proyecto Supabase compartido: todos los objetos van prefijados con cpp_lab_.
-- El acceso a datos se hace SIEMPRE desde el servidor (route handlers de Next.js)
-- con la publishable/anon key. Por eso los permisos de anon se limitan a
-- SELECT + INSERT; la revisión del profesor pasa por una función SECURITY DEFINER
-- que exige la clave del profesor.

-- 1 · Precondiciones: no pisar nada existente.
do $$
begin
  if exists (select 1 from pg_class where relname = 'cpp_lab_submissions' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.cpp_lab_submissions ya existe: revisa el estado antes de aplicar';
  end if;
  if exists (select 1 from pg_class where relname = 'cpp_lab_secrets' and relnamespace = 'public'::regnamespace) then
    raise exception 'public.cpp_lab_secrets ya existe: revisa el estado antes de aplicar';
  end if;
  if not exists (select 1 from pg_extension where extname = 'pgcrypto') then
    raise exception 'pgcrypto no está instalada';
  end if;
end $$;

-- 2 · Entregas.
create table public.cpp_lab_submissions (
  id              uuid primary key default gen_random_uuid(),
  title           text not null default 'Ejercicio sin título',
  code            text not null,
  stdin           text not null default '',
  compiler_output text not null default '',
  created_at      timestamptz not null default now(),
  review_status   text not null default 'pendiente',
  feedback        text not null default '',
  reviewed_at     timestamptz,
  constraint cpp_lab_submissions_status_chk
    check (review_status in ('pendiente', 'correcto', 'necesita_correccion')),
  constraint cpp_lab_submissions_code_chk
    check (length(code) between 1 and 100000),
  constraint cpp_lab_submissions_title_chk
    check (length(title) between 1 and 200),
  constraint cpp_lab_submissions_stdin_chk
    check (length(stdin) <= 20000),
  constraint cpp_lab_submissions_output_chk
    check (length(compiler_output) <= 100000),
  constraint cpp_lab_submissions_feedback_chk
    check (length(feedback) <= 20000)
);
comment on table public.cpp_lab_submissions is
  'Entregas del laboratorio de C++ (miguel-cpp-lab). Nunca se borran automáticamente.';

create index cpp_lab_submissions_created_at_idx
  on public.cpp_lab_submissions (created_at desc);

-- 3 · Clave del profesor (sólo el hash; ningún rol de la API puede leerla).
create table public.cpp_lab_secrets (
  name        text primary key,
  secret_hash text not null,
  updated_at  timestamptz not null default now()
);
comment on table public.cpp_lab_secrets is
  'Hash bcrypt de la clave del profesor. Sin grants: sólo la usan funciones SECURITY DEFINER.';

-- 4 · Permisos explícitos (los default privileges pueden estar revocados).
alter table public.cpp_lab_submissions enable row level security;
alter table public.cpp_lab_secrets     enable row level security;

revoke all on table public.cpp_lab_submissions from anon, authenticated, public;
revoke all on table public.cpp_lab_secrets     from anon, authenticated, public;

grant select, insert on table public.cpp_lab_submissions to anon, authenticated;

create policy cpp_lab_submissions_select_anon
  on public.cpp_lab_submissions for select to anon using (true);
create policy cpp_lab_submissions_select_auth
  on public.cpp_lab_submissions for select to authenticated using (true);

-- Una entrega nace siempre sin revisar: el alumno no puede fabricar un estado.
create policy cpp_lab_submissions_insert_anon
  on public.cpp_lab_submissions for insert to anon
  with check (review_status = 'pendiente' and feedback = '' and reviewed_at is null);
create policy cpp_lab_submissions_insert_auth
  on public.cpp_lab_submissions for insert to authenticated
  with check (review_status = 'pendiente' and feedback = '' and reviewed_at is null);

-- Sin UPDATE ni DELETE para anon/authenticated: una entrega enviada es inmutable.

-- 5 · Clave del profesor: verificación y enlace en el primer uso.
create or replace function public.cpp_lab_check_professor_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_hash text;
begin
  if p_key is null or length(p_key) < 12 or length(p_key) > 512 then
    return false;
  end if;

  select secret_hash into v_hash
    from public.cpp_lab_secrets where name = 'professor_key';

  if v_hash is null then
    -- Primer uso: la clave que llega del entorno del servidor queda enlazada.
    insert into public.cpp_lab_secrets (name, secret_hash)
      values ('professor_key', extensions.crypt(p_key, extensions.gen_salt('bf')))
      on conflict (name) do nothing;
    return true;
  end if;

  return v_hash = extensions.crypt(p_key, v_hash);
end $fn$;

create or replace function public.cpp_lab_review_submission(
  p_id uuid, p_status text, p_feedback text, p_key text
)
returns setof public.cpp_lab_submissions
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
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

  return query
    update public.cpp_lab_submissions
       set review_status = p_status,
           feedback      = coalesce(p_feedback, ''),
           reviewed_at   = now()
     where id = p_id
    returning *;
end $fn$;

-- Rotación: exige la clave actual, instala la nueva.
create or replace function public.cpp_lab_rotate_professor_key(p_current text, p_new text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  if not public.cpp_lab_check_professor_key(p_current) then
    raise exception 'clave de profesor incorrecta' using errcode = '28000';
  end if;
  if p_new is null or length(p_new) < 12 or length(p_new) > 512 then
    raise exception 'la clave nueva debe tener al menos 12 caracteres' using errcode = '22023';
  end if;

  insert into public.cpp_lab_secrets (name, secret_hash, updated_at)
    values ('professor_key', extensions.crypt(p_new, extensions.gen_salt('bf')), now())
  on conflict (name) do update
    set secret_hash = excluded.secret_hash, updated_at = now();
  return true;
end $fn$;

revoke all on function public.cpp_lab_check_professor_key(text)                    from public;
revoke all on function public.cpp_lab_review_submission(uuid, text, text, text)    from public;
revoke all on function public.cpp_lab_rotate_professor_key(text, text)             from public;
grant execute on function public.cpp_lab_check_professor_key(text)                 to anon, authenticated;
grant execute on function public.cpp_lab_review_submission(uuid, text, text, text) to anon, authenticated;
grant execute on function public.cpp_lab_rotate_professor_key(text, text)          to anon, authenticated;

-- 6 · Poscondiciones.
do $$
begin
  if not (select relrowsecurity from pg_class where oid = 'public.cpp_lab_submissions'::regclass) then
    raise exception 'RLS no quedó activo en cpp_lab_submissions';
  end if;
  if has_table_privilege('anon', 'public.cpp_lab_submissions', 'UPDATE')
     or has_table_privilege('anon', 'public.cpp_lab_submissions', 'DELETE') then
    raise exception 'anon no debe poder actualizar ni borrar entregas';
  end if;
  if has_table_privilege('anon', 'public.cpp_lab_secrets', 'SELECT') then
    raise exception 'anon no debe poder leer cpp_lab_secrets';
  end if;
end $$;
