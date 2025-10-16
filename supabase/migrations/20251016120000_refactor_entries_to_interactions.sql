-- supabase/migrations/20251016120000_refactor_entries_to_interactions.sql
-- Rename entries to interactions and expand schema

-- 1) Rename core tables
alter table entries rename to interactions;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entries_pkey'
  ) THEN
    EXECUTE 'alter table interactions rename constraint entries_pkey to interactions_pkey';
  END IF;
END;
$$;

-- Rename entry_zones -> interaction_zones and columns
alter table entry_zones rename to interaction_zones;
alter table interaction_zones rename column entry_id to interaction_id;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_zones_pkey'
  ) THEN
    EXECUTE 'alter table interaction_zones rename constraint entry_zones_pkey to interaction_zones_pkey';
  END IF;
END;
$$;

-- Rename entry_files -> documents and columns
alter table entry_files rename to documents;
alter table documents rename column entry_id to interaction_id;
alter table documents rename column storage_path to file_path;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'entry_files_pkey'
  ) THEN
    EXECUTE 'alter table documents rename constraint entry_files_pkey to documents_pkey';
  END IF;
END;
$$;

-- 2) Drop old triggers and helper functions no longer valid

-- Drop metadata trigger function for entries if present
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'update_entry_metadata') THEN
    EXECUTE 'drop function update_entry_metadata cascade';
  END IF;
END;
$$;

-- Drop entry zone enforcement helpers
DO $$ BEGIN EXECUTE 'drop trigger if exists trg_enforce_entry_has_zone_after_delete on interaction_zones'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'drop trigger if exists trg_enforce_entry_has_zone_after_update on interaction_zones'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'drop function if exists enforce_entry_has_zone_after_delete()'; EXCEPTION WHEN others THEN NULL; END $$;
DO $$ BEGIN EXECUTE 'drop function if exists enforce_entry_has_zone_after_update()'; EXCEPTION WHEN others THEN NULL; END $$;

-- Drop entry file trigger helpers
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'set_entry_file_created_by') THEN
    EXECUTE 'drop function set_entry_file_created_by() cascade';
  END IF;
END;
$$;

-- Drop legacy RPC
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_entry_with_zones') THEN
    EXECUTE 'drop function create_entry_with_zones(uuid, text, uuid[])';
  END IF;
END;
$$;

-- 3) Enhance interactions schema
alter table interactions
  rename column raw_text to content;

alter table interactions
  add column if not exists subject text,
  add column if not exists type text,
  add column if not exists status text,
  add column if not exists occurred_at timestamptz,
  add column if not exists tags text[] default '{}'::text[],
  add column if not exists contact_id uuid references contacts(id) on delete set null,
  add column if not exists structure_id uuid references structures(id) on delete set null;

-- Ensure existing rows have sensible defaults
update interactions
set
  subject = coalesce(nullif(trim(regexp_replace(content, '\\s+', ' ', 'g')), ''), 'Untitled interaction'),
  type = coalesce(type, 'note'),
  occurred_at = coalesce(occurred_at, created_at),
  tags = coalesce(tags, '{}'::text[])
where subject is null
   or type is null
   or occurred_at is null
   or tags is null;

-- Add constraints and defaults
alter table interactions
  alter column subject set not null,
  alter column subject set default 'Untitled interaction',
  alter column type set not null,
  alter column type set default 'note',
  alter column occurred_at set not null,
  alter column occurred_at set default now(),
  alter column tags set not null;

-- Refresh type/status constraints idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interactions_type_check') THEN
    EXECUTE 'alter table interactions drop constraint interactions_type_check';
  END IF;
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interactions_status_check') THEN
    EXECUTE 'alter table interactions drop constraint interactions_status_check';
  END IF;
END;
$$;

alter table interactions
  add constraint interactions_type_check
    check (type in ('note','todo','call','meeting','document','expense','message','signature','other')),
  add constraint interactions_status_check
    check (status is null or status in ('pending','in_progress','done','archived'));

-- Recreate metadata trigger function & trigger
create or replace function update_interaction_metadata()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists set_entry_metadata on interactions;
drop trigger if exists set_interaction_metadata on interactions;
create trigger set_interaction_metadata
before update on interactions
for each row execute function update_interaction_metadata();

-- Rebuild RLS policies for interactions
DROP POLICY IF EXISTS "Members can read entries of their household" ON interactions;
DROP POLICY IF EXISTS "Members can insert entries into their household" ON interactions;
DROP POLICY IF EXISTS "Members can update entries of their household" ON interactions;
DROP POLICY IF EXISTS "Members can delete entries of their household" ON interactions;

DROP POLICY IF EXISTS "Members can read interactions of their household" ON interactions;
DROP POLICY IF EXISTS "Members can insert interactions into their household" ON interactions;
DROP POLICY IF EXISTS "Members can update interactions of their household" ON interactions;
DROP POLICY IF EXISTS "Members can delete interactions of their household" ON interactions;

create policy "Members can read interactions of their household"
  on interactions for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = interactions.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert interactions into their household"
  on interactions for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = interactions.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update interactions of their household"
  on interactions for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = interactions.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete interactions of their household"
  on interactions for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = interactions.household_id
      and hm.user_id = auth.uid()
    )
  );

-- Helpful indexes
create index if not exists interactions_household_id_idx on interactions(household_id);
create index if not exists interactions_occurred_at_idx on interactions(occurred_at desc);
create index if not exists interactions_type_idx on interactions(type);
create index if not exists interactions_status_idx on interactions(status);
create index if not exists interactions_contact_id_idx on interactions(contact_id);
create index if not exists interactions_structure_id_idx on interactions(structure_id);
create index if not exists interactions_tags_idx on interactions using gin (tags);

-- 4) Interaction zones adjustments
DROP POLICY IF EXISTS "Members can manage entry_zones of their household" ON interaction_zones;
DROP POLICY IF EXISTS "Members can manage interaction_zones of their household" ON interaction_zones;

create policy "Members can manage interaction_zones of their household"
  on interaction_zones for all
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_zones.interaction_id
      and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_zones.interaction_id
      and hm.user_id = auth.uid()
    )
  );

-- Recreate enforcement triggers referencing interactions
create or replace function enforce_interaction_has_zone_after_delete()
returns trigger as $$
declare
  remaining int;
  interaction_present boolean;
begin
  select exists (select 1 from interactions i where i.id = old.interaction_id) into interaction_present;
  if not interaction_present then
    return old;
  end if;

  select count(*) into remaining from interaction_zones where interaction_id = old.interaction_id;
  if remaining = 0 then
    raise exception 'Interaction must have at least one zone';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_interaction_has_zone_after_delete on interaction_zones;
create trigger trg_enforce_interaction_has_zone_after_delete
after delete on interaction_zones
for each row execute function enforce_interaction_has_zone_after_delete();

create or replace function enforce_interaction_has_zone_after_update()
returns trigger as $$
declare
  remaining int;
  interaction_present boolean;
begin
  if old.interaction_id is distinct from new.interaction_id then
    select exists (select 1 from interactions i where i.id = old.interaction_id) into interaction_present;
    if interaction_present then
      select count(*) into remaining from interaction_zones where interaction_id = old.interaction_id;
      if remaining = 0 then
        raise exception 'Interaction must have at least one zone';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_enforce_interaction_has_zone_after_update on interaction_zones;
create trigger trg_enforce_interaction_has_zone_after_update
after update on interaction_zones
for each row execute function enforce_interaction_has_zone_after_update();

-- 5) Documents table enhancements
alter table documents
  add column if not exists name text,
  add column if not exists notes text,
  alter column metadata set default '{}'::jsonb;

-- Backfill names and defaults
update documents
set
  name = coalesce(name, coalesce(metadata ->> 'customName', regexp_replace(file_path, '^.*/', ''))),
  notes = coalesce(notes, ''),
  metadata = coalesce(metadata, '{}'::jsonb)
where name is null
   or notes is null
   or metadata is null;

alter table documents
  alter column name set not null,
  alter column name set default '',
  alter column notes set default '',
  alter column notes set not null,
  alter column metadata set not null;

-- Refresh type constraint (idempotent)
DO $$
DECLARE
  constraint_exists boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'entry_files_type_check'
  ) INTO constraint_exists;

  IF constraint_exists THEN
    EXECUTE 'alter table documents drop constraint entry_files_type_check';
  END IF;
END;
$$;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'documents_type_check') THEN
    EXECUTE 'alter table documents drop constraint documents_type_check';
  END IF;
END;
$$;

alter table documents
  add constraint documents_type_check
    check (type in ('document','photo','quote','invoice','contract','other'));

-- Rebuild RLS policies
DROP POLICY IF EXISTS "Members can select entry_files of their household" ON documents;
DROP POLICY IF EXISTS "Members can insert entry_files in their household" ON documents;
DROP POLICY IF EXISTS "Members can update entry_files of their household" ON documents;
DROP POLICY IF EXISTS "Members can delete entry_files of their household" ON documents;

DROP POLICY IF EXISTS "Members can select documents of their household" ON documents;
DROP POLICY IF EXISTS "Members can insert documents in their household" ON documents;
DROP POLICY IF EXISTS "Members can update documents of their household" ON documents;
DROP POLICY IF EXISTS "Members can delete documents of their household" ON documents;

create policy "Members can select documents of their household"
  on documents for select
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert documents in their household"
  on documents for insert
  with check (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update documents of their household"
  on documents for update
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete documents of their household"
  on documents for delete
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = documents.interaction_id
        and hm.user_id = auth.uid()
    )
  );

-- Restore created_by trigger
create or replace function set_document_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_entry_files_set_created_by on documents;
drop trigger if exists trg_documents_set_created_by on documents;
create trigger trg_documents_set_created_by
before insert on documents
for each row execute function set_document_created_by();

-- Helpful indexes for documents
create index if not exists documents_interaction_id_idx on documents(interaction_id);
create index if not exists documents_created_at_idx on documents(created_at desc);
create index if not exists documents_type_idx on documents(type);

-- 6) Storage policy update for files bucket
DO $$ BEGIN EXECUTE 'drop policy if exists files_household_select on storage.objects'; EXCEPTION WHEN others THEN NULL; END $$;

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
      join interactions i on i.id = d.interaction_id
      join household_members hm on hm.household_id = i.household_id
      where d.file_path = storage.objects.name
        and hm.user_id = auth.uid()
    )
  );

-- 7) Recreate RPC for interaction creation
-- (IMPORTANT: required params come first; no required param after defaults)
-- If an older version exists, drop it explicitly to avoid arg-order conflicts.
do $$
begin
  if exists (
    select 1 from pg_proc
    where proname = 'create_interaction_with_zones'
  ) then
    -- attempt to drop common prior signatures; ignore if not present
    begin
      execute 'drop function create_interaction_with_zones(uuid, text, text, text, text, timestamptz, uuid[], text[], uuid, uuid)';
    exception when undefined_function then null; end;
    begin
      execute 'drop function create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, text[], uuid, uuid)';
    exception when undefined_function then null; end;
  end if;
end$$;

create or replace function create_interaction_with_zones(
  -- required first
  p_household_id uuid,
  p_subject text,
  p_zone_ids uuid[],
  -- optional with defaults
  p_content text default '',
  p_type text default 'note',
  p_status text default null,
  p_occurred_at timestamptz default null,
  p_tags text[] default null,
  p_contact_id uuid default null,
  p_structure_id uuid default null
)
returns uuid
language plpgsql
as $$
declare
  v_user uuid;
  v_count int;
  v_interaction_id uuid;
  v_allowed_types constant text[] := ARRAY['note','todo','call','meeting','document','expense','message','signature','other'];
  v_allowed_status constant text[] := ARRAY['pending','in_progress','done','archived'];
  v_contact_household uuid;
  v_structure_household uuid;
  v_effective_tags text[];
  v_effective_occurred_at timestamptz;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  if p_subject is null or length(btrim(p_subject)) = 0 then
    raise exception 'subject is required';
  end if;

  if p_zone_ids is null or array_length(p_zone_ids, 1) is null then
    raise exception 'At least one zone is required';
  end if;

  if NOT (p_type = any(v_allowed_types)) then
    raise exception 'Invalid interaction type';
  end if;

  if p_status is not null and NOT (p_status = any(v_allowed_status)) then
    raise exception 'Invalid interaction status';
  end if;

  v_effective_tags := coalesce(p_tags, ARRAY[]::text[]);
  v_effective_occurred_at := coalesce(p_occurred_at, now());

  -- Must be a member of the household
  select count(*) into v_count
  from household_members hm
  where hm.household_id = p_household_id and hm.user_id = v_user;
  if v_count = 0 then
    raise exception 'Not a member of household';
  end if;

  -- All zones must belong to the same household
  select count(*) into v_count
  from zones z
  where z.household_id = p_household_id and z.id = any(p_zone_ids);
  if v_count <> coalesce(array_length(p_zone_ids, 1), 0) then
    raise exception 'All zones must belong to the same household';
  end if;

  -- Validate optional contact
  if p_contact_id is not null then
    select household_id into v_contact_household from contacts where id = p_contact_id;
    if v_contact_household is null or v_contact_household <> p_household_id then
      raise exception 'Contact must belong to household';
    end if;
  end if;

  -- Validate optional structure
  if p_structure_id is not null then
    select household_id into v_structure_household from structures where id = p_structure_id;
    if v_structure_household is null or v_structure_household <> p_household_id then
      raise exception 'Structure must belong to household';
    end if;
  end if;

  insert into interactions (
    household_id,
    subject,
    content,
    type,
    status,
    occurred_at,
    tags,
    contact_id,
    structure_id,
    metadata,
    enriched_text,
    created_by
  )
  values (
    p_household_id,
    trim(p_subject),
    coalesce(p_content, ''),
    p_type,
    p_status,
    v_effective_occurred_at,
    v_effective_tags,
    p_contact_id,
    p_structure_id,
    '{}'::jsonb,
    null,
    v_user
  )
  returning id into v_interaction_id;

  insert into interaction_zones(interaction_id, zone_id)
  select v_interaction_id, z_id from unnest(p_zone_ids) as z_id;

  return v_interaction_id;
end;
$$;

-- Backward compatible wrapper (deprecated)
drop function if exists create_entry_with_zones(uuid, text, uuid[]);
create or replace function create_entry_with_zones(
  p_household_id uuid,
  p_raw_text text,
  p_zone_ids uuid[]
)
returns uuid
language plpgsql
as $$
declare
  v_subject text;
begin
  v_subject := coalesce(nullif(trim(p_raw_text), ''), 'Untitled interaction');
  return create_interaction_with_zones(
    p_household_id,
    v_subject,
    p_zone_ids,          -- note: new signature requires zone ids earlier
    coalesce(p_raw_text, ''),
    'note',
    null,
    null,
    null,
    null,
    null
  );
end;
$$;