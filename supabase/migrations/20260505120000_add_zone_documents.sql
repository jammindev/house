-- supabase/migrations/20260305120000_add_zone_documents.sql
-- Link photo documents to zones so households can maintain visual galleries per zone.

-- 1) Join table between zones and documents
create table if not exists zone_documents (
  zone_id uuid not null references zones(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  role text not null default 'photo',
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (zone_id, document_id)
);

alter table zone_documents enable row level security;

create index if not exists zone_documents_document_id_idx on zone_documents(document_id);
create index if not exists zone_documents_created_at_idx on zone_documents(created_at desc);

-- 2) Maintain created_by metadata
create or replace function set_zone_documents_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_zone_documents_set_created_by on zone_documents;
create trigger trg_zone_documents_set_created_by
before insert on zone_documents
for each row execute function set_zone_documents_created_by();

-- 3) Ensure linked documents belong to the same household as the zone and are photos
create or replace function ensure_zone_documents_same_household()
returns trigger as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from zones z
    join documents d on d.id = new.document_id
    where z.id = new.zone_id
      and d.household_id = z.household_id
      and d.type = 'photo'
  ) into v_ok;

  if not v_ok then
    raise exception 'Zone and document must belong to the same household and document must be a photo';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_zone_documents_household on zone_documents;
create trigger trg_zone_documents_household
before insert or update on zone_documents
for each row execute function ensure_zone_documents_same_household();

-- 4) RLS policies
drop policy if exists "Members can select zone_documents of their household" on zone_documents;
drop policy if exists "Members can insert zone_documents in their household" on zone_documents;
drop policy if exists "Members can update zone_documents of their household" on zone_documents;
drop policy if exists "Members can delete zone_documents of their household" on zone_documents;

create policy "Members can select zone_documents of their household"
  on zone_documents for select
  using (
    exists (
      select 1
      from zones z
      join household_members hm on hm.household_id = z.household_id
      where z.id = zone_documents.zone_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert zone_documents in their household"
  on zone_documents for insert
  with check (
    exists (
      select 1
      from zones z
      join household_members hm on hm.household_id = z.household_id
      join documents d on d.id = zone_documents.document_id
      where z.id = zone_documents.zone_id
        and d.household_id = z.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update zone_documents of their household"
  on zone_documents for update
  using (
    exists (
      select 1
      from zones z
      join household_members hm on hm.household_id = z.household_id
      where z.id = zone_documents.zone_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from zones z
      join household_members hm on hm.household_id = z.household_id
      join documents d on d.id = zone_documents.document_id
      where z.id = zone_documents.zone_id
        and d.household_id = z.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete zone_documents of their household"
  on zone_documents for delete
  using (
    exists (
      select 1
      from zones z
      join household_members hm on hm.household_id = z.household_id
      where z.id = zone_documents.zone_id
        and hm.user_id = auth.uid()
    )
  );
