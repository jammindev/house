-- Ensure storage access is restricted to the uploading user only for 'files' bucket
-- Drop old policies if they exist (names from template)
do $$ begin
  begin execute 'drop policy "Give users access to own folder 1m0cqf_0" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy "Give users access to own folder 1m0cqf_1" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy "Give users access to own folder 1m0cqf_2" on storage.objects'; exception when others then null; end;
  begin execute 'drop policy "Give users access to own folder 1m0cqf_3" on storage.objects'; exception when others then null; end;
end $$;

-- Owner-only access policies by path prefix `${auth.uid()}/...`
create policy "files_owner_delete"
on storage.objects
as permissive
for delete
to authenticated
using (
  bucket_id = 'files'::text
  and auth.uid() is not null
  and name ~ ('^' || auth.uid() || '/')
);

create policy "files_owner_update"
on storage.objects
as permissive
for update
to authenticated
using (
  bucket_id = 'files'::text
  and auth.uid() is not null
  and name ~ ('^' || auth.uid() || '/')
);

create policy "files_owner_insert"
on storage.objects
as permissive
for insert
to authenticated
with check (
  bucket_id = 'files'::text
  and auth.uid() is not null
  and name ~ ('^' || auth.uid() || '/')
);

create policy "files_owner_select"
on storage.objects
as permissive
for select
to authenticated
using (
  bucket_id = 'files'::text
  and auth.uid() is not null
  and name ~ ('^' || auth.uid() || '/')
);

