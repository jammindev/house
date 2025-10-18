-- supabase/migrations/20251101090000_add_interaction_tags.sql
-- Introduce reusable tags tables scoped by type and migrate interaction tags

-- 1) Tags table scoped by household & type
create table if not exists tags (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  type text not null default 'interaction',
  name text not null,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id)
);

create unique index if not exists tags_unique_household_type_name_idx
  on tags (household_id, type, lower(name));

alter table tags enable row level security;

create or replace function set_tag_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_tags_set_created_by on tags;
create trigger trg_tags_set_created_by
before insert on tags
for each row execute function set_tag_created_by();

create policy "Members can read tags of their household"
  on tags for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = tags.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert tags into their household"
  on tags for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = tags.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update tags of their household"
  on tags for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = tags.household_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = tags.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete tags of their household"
  on tags for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = tags.household_id
        and hm.user_id = auth.uid()
    )
  );

-- 2) Join table linking interactions to tags
create table if not exists interaction_tags (
  interaction_id uuid not null references interactions(id) on delete cascade,
  tag_id uuid not null references tags(id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (interaction_id, tag_id)
);

alter table interaction_tags enable row level security;

create or replace function set_interaction_tag_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_interaction_tags_set_created_by on interaction_tags;
create trigger trg_interaction_tags_set_created_by
before insert on interaction_tags
for each row execute function set_interaction_tag_created_by();

create policy "Members can read interaction tag links in their household"
  on interaction_tags for select
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_tags.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert interaction tag links in their household"
  on interaction_tags for insert
  with check (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      join tags t on t.id = interaction_tags.tag_id
      where i.id = interaction_tags.interaction_id
        and hm.user_id = auth.uid()
        and t.household_id = i.household_id
        and t.type = 'interaction'
    )
  );

create policy "Members can delete interaction tag links in their household"
  on interaction_tags for delete
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      join tags t on t.id = interaction_tags.tag_id
      where i.id = interaction_tags.interaction_id
        and hm.user_id = auth.uid()
        and t.household_id = i.household_id
        and t.type = 'interaction'
    )
  );

-- 3) Migrate existing interaction tags stored as text[]
with distinct_interaction_tags as (
  select distinct
    i.household_id,
    trim(tag_value) as tag_name
  from interactions i
  cross join lateral unnest(i.tags) as tag_value
  where i.tags is not null
    and array_length(i.tags, 1) > 0
    and trim(tag_value) <> ''
)
insert into tags (household_id, name, type, created_by)
select t.household_id, t.tag_name, 'interaction', null
from distinct_interaction_tags t
on conflict (household_id, type, lower(name)) do nothing;

insert into interaction_tags (interaction_id, tag_id, created_by)
select
  i.id,
  tag_row.id,
  i.created_by
from interactions i
cross join lateral unnest(i.tags) as raw_tag
join tags tag_row
  on tag_row.household_id = i.household_id
 and tag_row.type = 'interaction'
 and lower(tag_row.name) = lower(trim(raw_tag))
where i.tags is not null
  and array_length(i.tags, 1) > 0
  and trim(raw_tag) <> ''
on conflict do nothing;

-- 4) Drop legacy tags array column
alter table interactions drop column if exists tags;

-- 5) Refresh RPC signature to use tag ids
do $$
begin
  if exists (
    select 1
    from pg_proc
    where proname = 'create_interaction_with_zones'
  ) then
    begin
      execute 'drop function create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, text[], uuid, uuid)';
    exception when undefined_function then null; end;
    begin
      execute 'drop function create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, text[], uuid, uuid)';
    exception when undefined_function then null; end;
    begin
      execute 'drop function create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, uuid[], text[], uuid, uuid)';
    exception when undefined_function then null; end;
  end if;
end$$;

create or replace function create_interaction_with_zones(
  p_household_id uuid,
  p_subject text,
  p_zone_ids uuid[],
  p_content text default '',
  p_type text default 'note',
  p_status text default null,
  p_occurred_at timestamptz default null,
  p_tag_ids uuid[] default null,
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
  v_effective_occurred_at timestamptz;
  v_effective_tag_ids uuid[];
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

  v_effective_occurred_at := coalesce(p_occurred_at, now());
  v_effective_tag_ids := coalesce(p_tag_ids, ARRAY[]::uuid[]);

  if array_length(v_effective_tag_ids, 1) is not null then
    select array_agg(distinct tag_id)
      into v_effective_tag_ids
    from unnest(v_effective_tag_ids) as t(tag_id);
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

  if p_contact_id is not null then
    select household_id into v_contact_household
    from contacts
    where id = p_contact_id;
    if v_contact_household is null or v_contact_household <> p_household_id then
      raise exception 'Contact must belong to household';
    end if;
  end if;

  if p_structure_id is not null then
    select household_id into v_structure_household
    from structures
    where id = p_structure_id;
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
    p_contact_id,
    p_structure_id,
    '{}'::jsonb,
    null,
    v_user
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

  return v_interaction_id;
end;
$$;

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
    null
  );
end;
$$;
