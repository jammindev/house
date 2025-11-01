insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', false)
on conflict (id) do nothing;

create policy "Users manage own avatar delete"
on storage.objects
as permissive
for delete
to authenticated
using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name ~ ('^' || auth.uid() || '/')
);

create policy "Users manage own avatar update"
on storage.objects
as permissive
for update
to authenticated
using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name ~ ('^' || auth.uid() || '/')
)
with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name ~ ('^' || auth.uid() || '/')
);

create policy "Users manage own avatar insert"
on storage.objects
as permissive
for insert
to authenticated
with check (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name ~ ('^' || auth.uid() || '/')
    and lower(coalesce(storage.extension(name), '')) = any (array['png','jpg','jpeg','webp'])
);

create policy "Users view own avatar"
on storage.objects
as permissive
for select
to authenticated
using (
    bucket_id = 'avatars'
    and auth.uid() is not null
    and name ~ ('^' || auth.uid() || '/')
);
