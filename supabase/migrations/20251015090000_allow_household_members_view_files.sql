-- Allow household members to view entry attachments stored in the files bucket
create policy "files_household_select"
  on storage.objects
  as permissive
  for select
  to authenticated
  using (
    bucket_id = 'files'::text
    and auth.uid() is not null
    and exists (
      select 1
      from entry_files ef
      join entries e on e.id = ef.entry_id
      join household_members hm on hm.household_id = e.household_id
      where ef.storage_path = storage.objects.name
        and hm.user_id = auth.uid()
    )
  );
