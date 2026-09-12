-- El guardarraíl de la base rechaza DELETE sin WHERE.
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
  delete from public.cpp_lab_setup_window where id = true;
  return true;
end $fn$;

revoke all on function public.cpp_lab_set_professor_key(text) from public;
grant execute on function public.cpp_lab_set_professor_key(text) to anon, authenticated;
