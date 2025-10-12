-- supabase/migrations/20251011103000_delete_entry_with_files_rpc.sql
-- RPC: delete_entry_with_files
-- Supprime une entrée et tous les fichiers liés (dans le bucket 'files')
-- - Si aucun fichier n'est lié, supprime simplement l'entrée
-- - Si une erreur survient pendant la suppression des fichiers, rollback total

create or replace function delete_entry_with_files(p_entry_id uuid)
returns void
language plpgsql
security definer
set search_path = public, storage, extensions
as $$
declare
  v_household_id uuid;
  v_file_count int;
  v_deleted_count int;
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

  -- 4️⃣ Compter les fichiers liés à l'entrée
  select count(*) into v_file_count
  from entry_files
  where entry_id = p_entry_id;

  -- 5️⃣ Supprimer les fichiers si il y en a
  if v_file_count > 0 then
    begin
      delete from storage.objects o
      using entry_files ef
      where ef.entry_id = p_entry_id
        and o.bucket_id = 'files'
        and o.name = ef.storage_path
      returning 1 into v_deleted_count;

      -- Vérifier que tous les fichiers ont été supprimés
      if v_deleted_count is null or v_deleted_count < v_file_count then
        raise exception 'Failed to delete all linked storage files' using errcode = 'P0001';
      end if;
    exception when others then
      -- Si une erreur survient, rollback total
      raise exception 'Error while deleting storage files: %', sqlerrm;
    end;
  end if;

  -- 6️⃣ Supprimer l’entrée (cascade sur entry_files et entry_zones)
  delete from entries e where e.id = p_entry_id;

  raise notice 'Entry % (and % files) deleted by user %', p_entry_id, coalesce(v_file_count, 0), auth.uid();
end;
$$;

grant execute on function delete_entry_with_files(uuid) to authenticated;