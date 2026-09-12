-- La clave del profesor deja de depender de una variable de entorno: la define
-- el propio profesor desde /profesor, pero sólo dentro de una ventana de alta
-- que se abre explícitamente desde la consola de Supabase. Así nadie puede
-- reclamar la clave antes que él.

create table if not exists public.cpp_lab_setup_window (
  id         boolean primary key default true check (id),
  open_until timestamptz not null,
  updated_at timestamptz not null default now()
);
comment on table public.cpp_lab_setup_window is
  'Ventana temporal durante la cual se puede dar de alta la clave del profesor.';

alter table public.cpp_lab_setup_window enable row level security;
revoke all on table public.cpp_lab_setup_window from anon, authenticated, public;

-- Sin auto-enlace: verificar es sólo verificar.
create or replace function public.cpp_lab_check_professor_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
declare
  v_hash text;
begin
  if p_key is null or length(p_key) < 8 or length(p_key) > 512 then
    return false;
  end if;

  select secret_hash into v_hash
    from public.cpp_lab_secrets where name = 'professor_key';

  if v_hash is null then
    return false;
  end if;

  return v_hash = extensions.crypt(p_key, v_hash);
end $fn$;

-- Estado que necesita la interfaz: ¿hay clave?, ¿está abierta el alta?
create or replace function public.cpp_lab_professor_status()
returns json
language sql
security definer
set search_path = public, pg_temp
as $fn$
  select json_build_object(
    'bound', exists (select 1 from public.cpp_lab_secrets where name = 'professor_key'),
    'setupOpen', exists (select 1 from public.cpp_lab_setup_window where open_until > now())
  );
$fn$;

-- Alta de la clave: sólo si no hay ninguna y la ventana sigue abierta.
create or replace function public.cpp_lab_set_professor_key(p_key text)
returns boolean
language plpgsql
security definer
set search_path = public, extensions, pg_temp
as $fn$
begin
  if p_key is null or length(p_key) < 8 or length(p_key) > 512 then
    raise exception 'la clave debe tener al menos 8 caracteres' using errcode = '22023';
  end if;
  if exists (select 1 from public.cpp_lab_secrets where name = 'professor_key') then
    raise exception 'ya existe una clave de profesor' using errcode = '28000';
  end if;
  if not exists (select 1 from public.cpp_lab_setup_window where open_until > now()) then
    raise exception 'el alta de la clave no esta abierta' using errcode = '28000';
  end if;

  insert into public.cpp_lab_secrets (name, secret_hash)
    values ('professor_key', extensions.crypt(p_key, extensions.gen_salt('bf')));
  delete from public.cpp_lab_setup_window;
  return true;
end $fn$;

-- Abrir la ventana de alta. Sin grants: sólo desde la consola de Supabase.
create or replace function public.cpp_lab_open_setup_window(p_minutes int default 30)
returns timestamptz
language plpgsql
security definer
set search_path = public, pg_temp
as $fn$
declare
  v_until timestamptz := now() + make_interval(mins => greatest(1, least(p_minutes, 1440)));
begin
  insert into public.cpp_lab_setup_window (id, open_until, updated_at)
       values (true, v_until, now())
  on conflict (id) do update set open_until = excluded.open_until, updated_at = now();
  return v_until;
end $fn$;

-- La revisión pasa a poder corregir también el nombre del ejercicio.
drop function if exists public.cpp_lab_review_submission(uuid, text, text, text);

create or replace function public.cpp_lab_review_submission(
  p_id uuid, p_status text, p_feedback text, p_title text, p_key text
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
  if p_title is not null and (length(btrim(p_title)) = 0 or length(p_title) > 200) then
    raise exception 'título inválido' using errcode = '22023';
  end if;

  return query
    update public.cpp_lab_submissions
       set review_status = p_status,
           feedback      = coalesce(p_feedback, ''),
           title         = coalesce(nullif(btrim(p_title), ''), title),
           reviewed_at   = now()
     where id = p_id
    returning *;
end $fn$;

revoke all on function public.cpp_lab_check_professor_key(text)                          from public;
revoke all on function public.cpp_lab_professor_status()                                 from public;
revoke all on function public.cpp_lab_set_professor_key(text)                            from public;
revoke all on function public.cpp_lab_open_setup_window(int)                             from public, anon, authenticated;
revoke all on function public.cpp_lab_review_submission(uuid, text, text, text, text)    from public;
grant execute on function public.cpp_lab_check_professor_key(text)                       to anon, authenticated;
grant execute on function public.cpp_lab_professor_status()                              to anon, authenticated;
grant execute on function public.cpp_lab_set_professor_key(text)                         to anon, authenticated;
grant execute on function public.cpp_lab_review_submission(uuid, text, text, text, text) to anon, authenticated;

do $$
begin
  if has_function_privilege('anon', 'public.cpp_lab_open_setup_window(int)', 'EXECUTE') then
    raise exception 'anon no debe poder abrir la ventana de alta';
  end if;
  if has_table_privilege('anon', 'public.cpp_lab_setup_window', 'SELECT') then
    raise exception 'anon no debe poder leer la ventana de alta';
  end if;
end $$;
