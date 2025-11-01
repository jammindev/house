-- supabase/migrations/20251101120000_allow_visite_interaction_type.sql
-- Allow 'visite' as a valid interactions.type and update creation RPCs

-- 1) Extend interactions.type check constraint idempotently
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'interactions_type_check') THEN
    EXECUTE 'alter table interactions drop constraint interactions_type_check';
  END IF;
END;
$$;

alter table interactions
  add constraint interactions_type_check
    check (type in ('note','todo','call','meeting','document','expense','message','signature','other','quote','visit'));


-- 2) Refresh create_interaction_with_zones RPC variants to accept 'visite'
-- Drop several common prior signatures if present to avoid arg-order conflicts.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'create_interaction_with_zones') THEN
    -- try drops for known historical signatures; ignore undefined_function errors
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid, jsonb)';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid)';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, text[], uuid[], uuid[])';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[])';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid)';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, uuid[], uuid[], uuid[])';
    EXCEPTION WHEN undefined_function THEN NULL; END;
    BEGIN
      EXECUTE 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, text[], uuid, uuid)';
    EXCEPTION WHEN undefined_function THEN NULL; END;
  END IF;
END;
$$;

-- Create the canonical, up-to-date signature used by later migrations
create or replace function create_interaction_with_zones(
  p_household_id uuid,
  p_subject text,
  p_zone_ids uuid[],
  p_content text default '',
  p_type text default 'note',
  p_status text default null,
  p_occurred_at timestamptz default null,
  p_tag_ids uuid[] default null,
  p_contact_ids uuid[] default null,
  p_structure_ids uuid[] default null,
  p_project_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
as $$
declare
  v_user uuid;
  v_count int;
  v_interaction_id uuid;
  v_allowed_types constant text[] := ARRAY['note','todo','call','meeting','document','expense','message','signature','other','quote','visite'];
  v_allowed_status constant text[] := ARRAY['pending','in_progress','done','archived'];
  v_effective_occurred_at timestamptz;
  v_effective_tag_ids uuid[];
  v_effective_contact_ids uuid[];
  v_effective_structure_ids uuid[];
  v_project_household uuid;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
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

  if not (p_type = any(v_allowed_types)) then
    raise exception 'Invalid interaction type';
  end if;

  if p_status is not null and not (p_status = any(v_allowed_status)) then
    raise exception 'Invalid interaction status';
  end if;

  v_effective_occurred_at := coalesce(p_occurred_at, now());
  v_effective_tag_ids := coalesce(p_tag_ids, ARRAY[]::uuid[]);
  v_effective_contact_ids := coalesce(p_contact_ids, ARRAY[]::uuid[]);
  v_effective_structure_ids := coalesce(p_structure_ids, ARRAY[]::uuid[]);

  if array_length(v_effective_tag_ids, 1) is not null then
    select array_agg(distinct tag_id)
      into v_effective_tag_ids
    from unnest(v_effective_tag_ids) as t(tag_id);
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    select array_agg(distinct contact_id)
      into v_effective_contact_ids
    from unnest(v_effective_contact_ids) as c(contact_id);
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    select array_agg(distinct structure_id)
      into v_effective_structure_ids
    from unnest(v_effective_structure_ids) as s(structure_id);
  end if;

  select count(*) into v_count
  from household_members hm
  where hm.household_id = p_household_id
    and hm.user_id = v_user;
  if v_count = 0 then
    raise exception 'Not a member of household';
  end if;

  select count(*) into v_count
  from zones z
  where z.household_id = p_household_id
    and z.id = any(p_zone_ids);
  if v_count <> coalesce(array_length(p_zone_ids, 1), 0) then
    raise exception 'All zones must belong to the same household';
  end if;

  if array_length(v_effective_tag_ids, 1) is not null then
    select count(*) into v_count
    from tags t
    where t.household_id = p_household_id
      and t.type = 'interaction'
      and t.id = any(v_effective_tag_ids);
    if v_count <> array_length(v_effective_tag_ids, 1) then
      raise exception 'Tags must belong to the household and be interaction tags';
    end if;
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    select count(*) into v_count
    from contacts c
    where c.household_id = p_household_id
      and c.id = any(v_effective_contact_ids);
    if v_count <> array_length(v_effective_contact_ids, 1) then
      raise exception 'Contacts must belong to the household';
    end if;
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    select count(*) into v_count
    from structures s
    where s.household_id = p_household_id
      and s.id = any(v_effective_structure_ids);
    if v_count <> array_length(v_effective_structure_ids, 1) then
      raise exception 'Structures must belong to the household';
    end if;
  end if;

  if p_project_id is not null then
    select household_id into v_project_household
    from projects
    where id = p_project_id;

    if v_project_household is null then
      raise exception 'Project does not exist';
    end if;

    if v_project_household <> p_household_id then
      raise exception 'Project must belong to the household';
    end if;
  end if;

  insert into interactions (
    household_id,
    subject,
    content,
    type,
    status,
    occurred_at,
    metadata,
    enriched_text,
    created_by,
    project_id
  )
  values (
    p_household_id,
    trim(p_subject),
    coalesce(p_content, ''),
    p_type,
    p_status,
    v_effective_occurred_at,
    v_metadata,
    null,
    v_user,
    p_project_id
  )
  returning id into v_interaction_id;

  insert into interaction_zones(interaction_id, zone_id)
  select v_interaction_id, z_id
  from unnest(p_zone_ids) as z_id;

  if array_length(v_effective_tag_ids, 1) is not null then
    insert into interaction_tags (interaction_id, tag_id, created_by)
    select v_interaction_id, tag_id, v_user
    from unnest(v_effective_tag_ids) as t(tag_id);
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    insert into interaction_contacts (interaction_id, contact_id)
    select v_interaction_id, contact_id
    from unnest(v_effective_contact_ids) as c(contact_id);
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    insert into interaction_structures (interaction_id, structure_id)
    select v_interaction_id, structure_id
    from unnest(v_effective_structure_ids) as s(structure_id);
  end if;

  return v_interaction_id;
end;
$$;

-- Backwards-compatible wrapper
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
    p_zone_ids,
    coalesce(p_raw_text, ''),
    'note',
    null,
    null,
    null,
    null,
    null,
    null,
    '{}'::jsonb
  );
end;
$$;
