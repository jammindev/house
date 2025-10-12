-- supabase/migrations/20251012075453_fix_delete_entry_with_files.sql
-- Fix: use storage.delete() to actually remove files from Supabase Storage

create or replace function delete_entry_with_files(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage, extensions
as $$
declare
  v_household_id uuid;
  v_file_count int;
begin
  -- 1️⃣ Vérifier que l'utilisateur est authentifié
  if auth.uid() is null then
    raise exception 'Not authenticated' using errcode = '42501';
  end if;

  -- 2️⃣ Récupérer le foyer (household) de l'entrée
  select e.household_id into v_household_id
  from entries e
  where e.id = p_entry_id;

  if v_household_id is null then
    raise exception 'Entry not found' using errcode = 'P0002';
  end if;

  -- 3️⃣ Vérifier que l'utilisateur est bien membre du foyer
  if not exists (
    select 1 from household_members hm
    where hm.household_id = v_household_id
      and hm.user_id = auth.uid()
  ) then
    raise exception 'Not authorized' using errcode = '42501';
  end if;

  -- 4️⃣ Supprimer les fichiers liés via l'API storage
  select count(*) into v_file_count
  from entry_files
  where entry_id = p_entry_id;

  if v_file_count > 0 then
    begin
      perform storage.delete('files', array_agg(storage_path))
      from entry_files
      where entry_id = p_entry_id;
    exception when others then
      raise exception 'Error while deleting storage files: %', sqlerrm;
    end;
  end if;

  -- 5️⃣ Supprimer les lignes entry_files et entries
  delete from entry_files where entry_id = p_entry_id;
  delete from entries where id = p_entry_id;

  raise notice 'Entry % (and % files) deleted by user %',
    p_entry_id, coalesce(v_file_count, 0), auth.uid();
end;
$$;

grant execute on function delete_entry_with_files(uuid) to authenticated;