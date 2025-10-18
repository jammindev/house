-- supabase/migrations/20251201120000_interaction_documents_m2m.sql
-- Introduce interaction_documents join table and decouple documents from a single interaction.

-- 1) Add household scope to documents
alter table documents
  add column if not exists household_id uuid;

update documents
set household_id = i.household_id
from interactions i
where i.id = documents.interaction_id
  and documents.household_id is null;

alter table documents
  alter column household_id set not null;

alter table documents
  drop constraint if exists documents_household_id_fkey;

alter table documents
  add constraint documents_household_id_fkey
    foreign key (household_id) references households(id) on delete cascade;

create index if not exists documents_household_id_idx on documents(household_id);

-- 2) Create join table for interaction ↔ document links
create table if not exists interaction_documents (
  interaction_id uuid not null references interactions(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  role text not null default 'attachment',
  note text not null default '',
  created_at timestamptz not null default now(),
  primary key (interaction_id, document_id)
);

alter table interaction_documents enable row level security;

create index if not exists interaction_documents_document_id_idx on interaction_documents(document_id);
create index if not exists interaction_documents_created_at_idx on interaction_documents(created_at desc);

-- 3) Backfill join data from existing documents
insert into interaction_documents (interaction_id, document_id, role, note, created_at)
select d.interaction_id, d.id, 'attachment', coalesce(d.notes, ''), coalesce(d.created_at, now())
from documents d
where d.interaction_id is not null
on conflict (interaction_id, document_id) do nothing;

-- 4) Drop legacy policies referencing documents.interaction_id
drop policy if exists "Members can select entry_files of their household" on documents;
drop policy if exists "Members can insert entry_files in their household" on documents;
drop policy if exists "Members can update entry_files of their household" on documents;
drop policy if exists "Members can delete entry_files of their household" on documents;

drop policy if exists "Members can select documents of their household" on documents;
drop policy if exists "Members can insert documents in their household" on documents;
drop policy if exists "Members can update documents of their household" on documents;
drop policy if exists "Members can delete documents of their household" on documents;

drop policy if exists "files_household_select" on storage.objects;

-- 5) Drop legacy foreign key/index and column from documents
alter table documents
  drop constraint if exists documents_interaction_id_fkey;

drop index if exists documents_interaction_id_idx;

alter table documents
  drop column if exists interaction_id cascade;

-- 6) Enforce household consistency for interaction_documents
create or replace function ensure_interaction_documents_same_household()
returns trigger as $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from interactions i
    join documents d on d.id = new.document_id
    where i.id = new.interaction_id
      and d.household_id = i.household_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Interaction and document must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_interaction_documents_household on interaction_documents;
create trigger trg_interaction_documents_household
before insert or update on interaction_documents
for each row execute function ensure_interaction_documents_same_household();

-- 7) Rebuild RLS policies for documents using household_id

create policy "Members can select documents of their household"
  on documents for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = documents.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert documents in their household"
  on documents for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = documents.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update documents of their household"
  on documents for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = documents.household_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = documents.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete documents of their household"
  on documents for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = documents.household_id
        and hm.user_id = auth.uid()
    )
  );

-- 8) Policies for interaction_documents
drop policy if exists "Members can manage interaction_documents of their household" on interaction_documents;
drop policy if exists "Members can select interaction_documents of their household" on interaction_documents;
drop policy if exists "Members can insert interaction_documents in their household" on interaction_documents;
drop policy if exists "Members can update interaction_documents of their household" on interaction_documents;
drop policy if exists "Members can delete interaction_documents of their household" on interaction_documents;

create policy "Members can select interaction_documents of their household"
  on interaction_documents for select
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert interaction_documents in their household"
  on interaction_documents for insert
  with check (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      join documents d on d.id = interaction_documents.document_id
      where i.id = interaction_documents.interaction_id
        and d.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update interaction_documents of their household"
  on interaction_documents for update
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_documents.interaction_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      join documents d on d.id = interaction_documents.document_id
      where i.id = interaction_documents.interaction_id
        and d.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete interaction_documents of their household"
  on interaction_documents for delete
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

-- 9) Update storage policy to use document household scope
drop policy if exists "files_household_select" on storage.objects;

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
      from documents d
      join household_members hm on hm.household_id = d.household_id
      where d.file_path = storage.objects.name
        and hm.user_id = auth.uid()
    )
  );
