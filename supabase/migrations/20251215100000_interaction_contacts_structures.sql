-- supabase/migrations/20251215100000_interaction_contacts_structures.sql
-- Introduce join tables for contacts and structures linked to interactions and update creation RPC.

-- 1) Create join tables ------------------------------------------------------
create table if not exists interaction_contacts (
  interaction_id uuid not null references interactions(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (interaction_id, contact_id)
);

alter table interaction_contacts enable row level security;

create index if not exists interaction_contacts_contact_id_idx on interaction_contacts(contact_id);
create index if not exists interaction_contacts_created_at_idx on interaction_contacts(created_at desc);

create table if not exists interaction_structures (
  interaction_id uuid not null references interactions(id) on delete cascade,
  structure_id uuid not null references structures(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (interaction_id, structure_id)
);

alter table interaction_structures enable row level security;

create index if not exists interaction_structures_structure_id_idx on interaction_structures(structure_id);
create index if not exists interaction_structures_created_at_idx on interaction_structures(created_at desc);

-- 2) Backfill legacy single-link columns -------------------------------------
insert into interaction_contacts (interaction_id, contact_id, created_at)
select id, contact_id, coalesce(updated_at, created_at, now())
from interactions
where contact_id is not null
on conflict (interaction_id, contact_id) do nothing;

insert into interaction_structures (interaction_id, structure_id, created_at)
select id, structure_id, coalesce(updated_at, created_at, now())
from interactions
where structure_id is not null
on conflict (interaction_id, structure_id) do nothing;

-- 3) Drop legacy columns and indexes -----------------------------------------
drop index if exists interactions_contact_id_idx;
alter table interactions drop column if exists contact_id;

drop index if exists interactions_structure_id_idx;
alter table interactions drop column if exists structure_id;

-- 4) Enforce household consistency -------------------------------------------
create or replace function ensure_interaction_contacts_same_household()
returns trigger as $$
declare
  v_valid boolean;
begin
  select exists (
    select 1
    from interactions i
    join contacts c on c.id = new.contact_id
    where i.id = new.interaction_id
      and c.household_id = i.household_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Interaction and contact must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_interaction_contacts_household on interaction_contacts;
create trigger trg_interaction_contacts_household
before insert or update on interaction_contacts
for each row execute function ensure_interaction_contacts_same_household();

create or replace function ensure_interaction_structures_same_household()
returns trigger as $$
declare
  v_valid boolean;
begin
  select exists (
    select 1
    from interactions i
    join structures s on s.id = new.structure_id
    where i.id = new.interaction_id
      and s.household_id = i.household_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Interaction and structure must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_interaction_structures_household on interaction_structures;
create trigger trg_interaction_structures_household
before insert or update on interaction_structures
for each row execute function ensure_interaction_structures_same_household();

-- 5) Row level security policies ---------------------------------------------
drop policy if exists "Members can select interaction_contacts of their household" on interaction_contacts;
drop policy if exists "Members can insert interaction_contacts in their household" on interaction_contacts;
drop policy if exists "Members can update interaction_contacts of their household" on interaction_contacts;
drop policy if exists "Members can delete interaction_contacts of their household" on interaction_contacts;

create policy "Members can select interaction_contacts of their household"
  on interaction_contacts for select
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_contacts.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert interaction_contacts in their household"
  on interaction_contacts for insert
  with check (
    exists (
      select 1
      from interactions i
      join contacts c on c.id = interaction_contacts.contact_id
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_contacts.interaction_id
        and c.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update interaction_contacts of their household"
  on interaction_contacts for update
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_contacts.interaction_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from interactions i
      join contacts c on c.id = interaction_contacts.contact_id
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_contacts.interaction_id
        and c.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete interaction_contacts of their household"
  on interaction_contacts for delete
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_contacts.interaction_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can select interaction_structures of their household" on interaction_structures;
drop policy if exists "Members can insert interaction_structures in their household" on interaction_structures;
drop policy if exists "Members can update interaction_structures of their household" on interaction_structures;
drop policy if exists "Members can delete interaction_structures of their household" on interaction_structures;

create policy "Members can select interaction_structures of their household"
  on interaction_structures for select
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_structures.interaction_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert interaction_structures in their household"
  on interaction_structures for insert
  with check (
    exists (
      select 1
      from interactions i
      join structures s on s.id = interaction_structures.structure_id
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_structures.interaction_id
        and s.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update interaction_structures of their household"
  on interaction_structures for update
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_structures.interaction_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from interactions i
      join structures s on s.id = interaction_structures.structure_id
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_structures.interaction_id
        and s.household_id = i.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete interaction_structures of their household"
  on interaction_structures for delete
  using (
    exists (
      select 1
      from interactions i
      join household_members hm on hm.household_id = i.household_id
      where i.id = interaction_structures.interaction_id
        and hm.user_id = auth.uid()
    )
  );

-- 6) Update RPC create_interaction_with_zones ---------------------------------
do $$
begin
  if exists (select 1 from pg_proc where proname = 'create_interaction_with_zones') then
    execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid, uuid)';
    execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, uuid[], uuid[], uuid)';
    execute 'drop function if exists create_interaction_with_zones(uuid, text, uuid[], text, text, timestamptz, text[], uuid, uuid)';
  end if;
end
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
  p_structure_ids uuid[] default null
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
  v_effective_occurred_at timestamptz;
  v_effective_tag_ids uuid[];
  v_effective_contact_ids uuid[];
  v_effective_structure_ids uuid[];
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

  insert into interactions (
    household_id,
    subject,
    content,
    type,
    status,
    occurred_at,
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
