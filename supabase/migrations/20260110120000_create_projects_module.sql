-- supabase/migrations/20260110120000_create_projects_module.sql
-- Introduce projects domain entity and tie interactions to projects.

-- 1) Domain types ----------------------------------------------------------------
do $$
begin
  if not exists (
    select 1
    from pg_type typ
    where typ.typname = 'project_status'
  ) then
    create type project_status as enum ('draft', 'active', 'on_hold', 'completed', 'cancelled');
  end if;
end;
$$;

-- 2) Core tables -----------------------------------------------------------------
create table if not exists projects (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  title text not null,
  description text default '',
  status project_status not null default 'draft',
  priority int not null default 3,
  start_date date,
  due_date date,
  closed_at timestamptz,
  tags text[] not null default '{}'::text[],
  planned_budget numeric(12, 2) not null default 0,
  actual_cost_cached numeric(12, 2) not null default 0,
  cover_interaction_id uuid references interactions(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid,
  constraint projects_priority_range check (priority between 1 and 5),
  constraint projects_planned_budget_non_negative check (planned_budget >= 0),
  constraint projects_actual_cost_non_negative check (actual_cost_cached >= 0),
  constraint projects_dates_consistent check (
    start_date is null
    or due_date is null
    or due_date >= start_date
  )
);

alter table projects enable row level security;

create index if not exists projects_household_status_idx on projects (household_id, status);
create index if not exists projects_household_start_date_idx on projects (household_id, start_date);
create index if not exists projects_household_due_date_idx on projects (household_id, due_date);
create index if not exists projects_created_at_idx on projects (created_at desc);
create index if not exists projects_text_search_idx
  on projects
  using gin (to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(description, '')));

-- 3) Audit helpers ---------------------------------------------------------------
create or replace function projects_set_created_fields()
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

create or replace function projects_set_updated_fields()
returns trigger as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  new.updated_at := now();
  if v_user is not null then
    new.updated_by := v_user;
  end if;

  if new.status = 'completed' and (old.status is distinct from 'completed') then
    if new.closed_at is null then
      new.closed_at := now();
    end if;
  elsif new.status <> 'completed' and old.status = 'completed' then
    -- Reopening a project clears the completion timestamp to keep semantics explicit.
    new.closed_at := null;
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_projects_set_created
before insert on projects
for each row execute function projects_set_created_fields();

create trigger trg_projects_set_updated
before update on projects
for each row execute function projects_set_updated_fields();

-- 4) Household consistency -------------------------------------------------------
create or replace function ensure_project_cover_interaction_same_household()
returns trigger as $$
declare
  v_cover_household uuid;
begin
  if new.cover_interaction_id is null then
    return new;
  end if;

  select household_id
    into v_cover_household
  from interactions
  where id = new.cover_interaction_id;

  if v_cover_household is null then
    raise exception 'cover interaction does not exist';
  end if;

  if v_cover_household <> new.household_id then
    raise exception 'cover interaction must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

create trigger trg_projects_cover_consistency
before insert or update on projects
for each row execute function ensure_project_cover_interaction_same_household();

-- 5) Row level security policies -------------------------------------------------
drop policy if exists "Members can select projects in their household" on projects;
create policy "Members can select projects in their household"
  on projects for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = projects.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can insert projects in their household" on projects;
create policy "Members can insert projects in their household"
  on projects for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = projects.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update projects in their household" on projects;
create policy "Members can update projects in their household"
  on projects for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = projects.household_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = projects.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete projects in their household" on projects;
create policy "Members can delete projects in their household"
  on projects for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = projects.household_id
        and hm.user_id = auth.uid()
    )
  );

-- 6) Interaction linkage ---------------------------------------------------------
alter table interactions
  add column if not exists project_id uuid references projects(id) on delete set null;

create index if not exists interactions_household_project_occurred_idx
  on interactions (household_id, project_id, occurred_at desc);

create or replace function ensure_interaction_project_same_household()
returns trigger as $$
declare
  v_project_household uuid;
begin
  if new.project_id is null then
    return new;
  end if;

  select household_id
    into v_project_household
  from projects
  where id = new.project_id;

  if v_project_household is null then
    raise exception 'project does not exist';
  end if;

  if v_project_household <> new.household_id then
    raise exception 'project must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_interactions_project_consistency on interactions;
create trigger trg_interactions_project_consistency
before insert or update on interactions
for each row execute function ensure_interaction_project_same_household();

-- 7) Interaction creation RPC extension -----------------------------------------
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
  p_project_id uuid default null
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
  v_project_household uuid;
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
    '{}'::jsonb,
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

-- 8) Expense handling ------------------------------------------------------------
create or replace function project_expense_amount(p_metadata jsonb)
returns numeric
language plpgsql
as $$
declare
  v_amount numeric := 0;
  v_text text;
  v_node jsonb;
begin
  if p_metadata is null then
    return 0;
  end if;

  v_node := p_metadata -> 'amount';
  if v_node is null then
    return 0;
  end if;

  if jsonb_typeof(v_node) = 'number' then
    return (v_node::text)::numeric;
  end if;

  if jsonb_typeof(v_node) = 'string' then
    v_text := btrim(v_node::text, '\"');
    v_text := btrim(v_text);
    if v_text ~ '^-?[0-9]+(\\.[0-9]+)?$' then
      v_amount := v_text::numeric;
      return v_amount;
    end if;
  end if;

  return 0;
end;
$$;

create or replace function refresh_project_actual_cost(p_project_id uuid)
returns void
language plpgsql
as $$
declare
  v_total numeric := 0;
  v_user uuid := auth.uid();
begin
  if p_project_id is null then
    return;
  end if;

  select coalesce(sum(project_expense_amount(i.metadata)), 0)
  into v_total
  from interactions i
  where i.project_id = p_project_id
    and i.type = 'expense';

  update projects
  set actual_cost_cached = v_total,
      updated_at = now(),
      updated_by = coalesce(v_user, updated_by)
  where id = p_project_id;
end;
$$;

create or replace function trg_refresh_project_actual_cost()
returns trigger as $$
declare
  v_old_changed boolean := false;
  v_new_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.project_id is not null and new.type = 'expense' then
      perform refresh_project_actual_cost(new.project_id);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    v_old_changed := (
      old.project_id is not null
      and old.type = 'expense'
      and (
        new.project_id is distinct from old.project_id
        or new.type is distinct from old.type
      )
    );

    v_new_changed := (
      new.project_id is not null
      and new.type = 'expense'
      and (
        new.project_id is distinct from old.project_id
        or new.type is distinct from old.type
        or coalesce(new.metadata, '{}'::jsonb) is distinct from coalesce(old.metadata, '{}'::jsonb)
      )
    );

    if v_old_changed then
      perform refresh_project_actual_cost(old.project_id);
    end if;

    if v_new_changed then
      perform refresh_project_actual_cost(new.project_id);
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.project_id is not null and old.type = 'expense' then
      perform refresh_project_actual_cost(old.project_id);
    end if;
    return old;
  end if;

  return null;
end;
$$ language plpgsql;

drop trigger if exists trg_interactions_refresh_project_cost on interactions;
create trigger trg_interactions_refresh_project_cost
after insert or update or delete on interactions
for each row execute function trg_refresh_project_actual_cost();

-- 9) Metrics view ----------------------------------------------------------------
drop view if exists project_metrics;
create or replace view project_metrics as
select
  p.id as project_id,
  coalesce(
    sum(
      case
        when i.type = 'todo' and coalesce(i.status, 'pending') not in ('done', 'archived') then 1
        else 0
      end
    ),
    0
  ) as open_todos,
  coalesce(
    sum(
      case
        when i.type = 'todo' and coalesce(i.status, 'pending') in ('done', 'archived') then 1
        else 0
      end
    ),
    0
  ) as done_todos,
  coalesce(count(distinct d.id), 0) as documents_count,
  p.actual_cost_cached as actual_cost
from projects p
left join interactions i on i.project_id = p.id
left join interaction_documents idoc on idoc.interaction_id = i.id
left join documents d on d.id = idoc.document_id
group by p.id;
