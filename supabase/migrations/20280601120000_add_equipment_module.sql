-- supabase/migrations/20280601120000_add_equipment_module.sql
-- Introduce equipment tracking plus interaction types to follow lifecycle events.

-- 1) Equipment table ------------------------------------------------------------
create table if not exists equipment (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  zone_id uuid references zones(id) on delete set null,
  name text not null,
  category text not null default 'general',
  manufacturer text,
  model text,
  serial_number text,
  purchase_date date,
  purchase_price numeric(12,2),
  purchase_vendor text,
  warranty_expires_on date,
  warranty_provider text,
  warranty_notes text not null default '',
  maintenance_interval_months integer,
  last_service_at date,
  next_service_due date generated always as (
    case
      when maintenance_interval_months is not null and last_service_at is not null
      then (last_service_at + make_interval(months => maintenance_interval_months))::date
    end
  ) stored,
  status text not null default 'active',
  condition text default 'good',
  installed_at date,
  retired_at date,
  notes text not null default '',
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table equipment enable row level security;

create index if not exists equipment_household_idx on equipment (household_id, created_at desc);
create index if not exists equipment_zone_idx on equipment (zone_id);
create index if not exists equipment_status_idx on equipment (status);
create index if not exists equipment_warranty_idx on equipment (warranty_expires_on);
create index if not exists equipment_next_service_due_idx on equipment (next_service_due);

-- Audit helpers
create or replace function equipment_set_created_fields()
returns trigger as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if new.created_at is null then
    new.created_at := now();
  end if;
  new.updated_at := coalesce(new.updated_at, new.created_at);

  if new.created_by is null then
    new.created_by := v_user;
  end if;
  if new.updated_by is null then
    new.updated_by := v_user;
  end if;

  return new;
end;
$$ language plpgsql;

create or replace function equipment_set_updated_fields()
returns trigger as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  new.updated_at := now();
  if v_user is not null then
    new.updated_by := v_user;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_equipment_set_created on equipment;
create trigger trg_equipment_set_created
before insert on equipment
for each row execute function equipment_set_created_fields();

drop trigger if exists trg_equipment_set_updated on equipment;
create trigger trg_equipment_set_updated
before update on equipment
for each row execute function equipment_set_updated_fields();

-- Keep zone/household consistent
create or replace function ensure_equipment_zone_matches_household()
returns trigger as $$
declare
  v_zone_household uuid;
begin
  if new.zone_id is null then
    return new;
  end if;

  select household_id into v_zone_household
  from zones
  where id = new.zone_id;

  if v_zone_household is null then
    raise exception 'Zone does not exist';
  end if;

  if v_zone_household <> new.household_id then
    raise exception 'Zone must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_equipment_zone_consistency on equipment;
create trigger trg_equipment_zone_consistency
before insert or update on equipment
for each row execute function ensure_equipment_zone_matches_household();

-- Status constraint
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'equipment_status_check') then
    execute 'alter table equipment drop constraint equipment_status_check';
  end if;
end $$;

alter table equipment
  add constraint equipment_status_check
    check (status in ('active','maintenance','storage','retired','lost','ordered'));

-- Policies
drop policy if exists "Members can select equipment in their household" on equipment;
create policy "Members can select equipment in their household"
  on equipment for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = equipment.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can insert equipment in their household" on equipment;
create policy "Members can insert equipment in their household"
  on equipment for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = equipment.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update equipment in their household" on equipment;
create policy "Members can update equipment in their household"
  on equipment for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = equipment.household_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = equipment.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete equipment in their household" on equipment;
create policy "Members can delete equipment in their household"
  on equipment for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = equipment.household_id
        and hm.user_id = auth.uid()
    )
  );

-- 2) Link equipment to interactions --------------------------------------------
create table if not exists equipment_interactions (
  equipment_id uuid not null references equipment(id) on delete cascade,
  interaction_id uuid not null references interactions(id) on delete cascade,
  role text not null default 'log',
  note text not null default '',
  created_at timestamptz not null default now(),
  created_by uuid,
  primary key (equipment_id, interaction_id)
);

alter table equipment_interactions enable row level security;

create index if not exists equipment_interactions_interaction_idx on equipment_interactions (interaction_id);
create index if not exists equipment_interactions_created_at_idx on equipment_interactions (created_at desc);

create or replace function set_equipment_interactions_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_equipment_interactions_set_created_by on equipment_interactions;
create trigger trg_equipment_interactions_set_created_by
before insert on equipment_interactions
for each row execute function set_equipment_interactions_created_by();

create or replace function ensure_equipment_interactions_same_household()
returns trigger as $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from equipment e
    join interactions i on i.id = new.interaction_id
    where e.id = new.equipment_id
      and e.household_id = i.household_id
  ) into v_ok;

  if not v_ok then
    raise exception 'Equipment and interaction must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_equipment_interactions_household on equipment_interactions;
create trigger trg_equipment_interactions_household
before insert or update on equipment_interactions
for each row execute function ensure_equipment_interactions_same_household();

drop policy if exists "Members can select equipment_interactions in their household" on equipment_interactions;
create policy "Members can select equipment_interactions in their household"
  on equipment_interactions for select
  using (
    exists (
      select 1
      from equipment e
      join household_members hm on hm.household_id = e.household_id
      where e.id = equipment_interactions.equipment_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can insert equipment_interactions in their household" on equipment_interactions;
create policy "Members can insert equipment_interactions in their household"
  on equipment_interactions for insert
  with check (
    exists (
      select 1
      from equipment e
      join interactions i on i.id = equipment_interactions.interaction_id
      join household_members hm on hm.household_id = e.household_id
      where e.id = equipment_interactions.equipment_id
        and i.household_id = e.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update equipment_interactions in their household" on equipment_interactions;
create policy "Members can update equipment_interactions in their household"
  on equipment_interactions for update
  using (
    exists (
      select 1
      from equipment e
      join household_members hm on hm.household_id = e.household_id
      where e.id = equipment_interactions.equipment_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from equipment e
      join interactions i on i.id = equipment_interactions.interaction_id
      join household_members hm on hm.household_id = e.household_id
      where e.id = equipment_interactions.equipment_id
        and i.household_id = e.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete equipment_interactions in their household" on equipment_interactions;
create policy "Members can delete equipment_interactions in their household"
  on equipment_interactions for delete
  using (
    exists (
      select 1
      from equipment e
      join household_members hm on hm.household_id = e.household_id
      where e.id = equipment_interactions.equipment_id
        and hm.user_id = auth.uid()
    )
  );

-- 3) Interaction types for lifecycle events ------------------------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'interactions_type_check') then
    execute 'alter table interactions drop constraint interactions_type_check';
  end if;
end $$;

alter table interactions
  add constraint interactions_type_check
    check (
      type in (
        'note','todo','call','meeting','document','expense','message','signature','other',
        'quote','visit','visite',
        'maintenance','repair','installation','inspection','warranty','issue','upgrade','replacement','disposal'
      )
    );

-- Refresh create_interaction_with_zones to accept the new types (keep legacy drops for safety)
do $$
begin
  if exists (select 1 from pg_proc where proname = 'create_interaction_with_zones') then
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid, jsonb)'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid)'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, text[], uuid[], uuid[])'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[])'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid)'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, uuid[], uuid[], uuid[])'; exception when undefined_function then null; end;
    begin execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, text[], uuid, uuid)'; exception when undefined_function then null; end;
  end if;
end;
$$;

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
  v_allowed_types constant text[] := ARRAY[
    'note','todo','call','meeting','document','expense','message','signature','other',
    'quote','visit','visite',
    'maintenance','repair','installation','inspection','warranty','issue','upgrade','replacement','disposal'
  ];
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
