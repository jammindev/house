-- supabase/migrations/20260405100000_create_project_groups.sql
-- Introduce project groups to organize projects under shared initiatives.

-- 1) Core table ------------------------------------------------------------------
create table if not exists project_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,
  name text not null,
  description text default '',
  tags text[] not null default '{}'::text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid,
  updated_by uuid
);

alter table project_groups enable row level security;

create index if not exists project_groups_household_idx on project_groups (household_id, created_at desc);
create index if not exists project_groups_name_search_idx on project_groups using gin (to_tsvector('simple', coalesce(name, '') || ' ' || coalesce(description, '')));

-- 2) Audit helpers ---------------------------------------------------------------
create or replace function project_groups_set_created_fields()
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

create or replace function project_groups_set_updated_fields()
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

create trigger trg_project_groups_set_created
before insert on project_groups
for each row execute function project_groups_set_created_fields();

create trigger trg_project_groups_set_updated
before update on project_groups
for each row execute function project_groups_set_updated_fields();

-- 3) Policies --------------------------------------------------------------------
drop policy if exists "Members can select project groups in their household" on project_groups;
create policy "Members can select project groups in their household"
  on project_groups for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = project_groups.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can insert project groups in their household" on project_groups;
create policy "Members can insert project groups in their household"
  on project_groups for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = project_groups.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can update project groups in their household" on project_groups;
create policy "Members can update project groups in their household"
  on project_groups for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = project_groups.household_id
        and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = project_groups.household_id
        and hm.user_id = auth.uid()
    )
  );

drop policy if exists "Members can delete project groups in their household" on project_groups;
create policy "Members can delete project groups in their household"
  on project_groups for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = project_groups.household_id
        and hm.user_id = auth.uid()
    )
  );

-- 4) Link projects to groups -----------------------------------------------------
alter table projects
  add column if not exists project_group_id uuid references project_groups(id) on delete set null;

create index if not exists projects_group_idx on projects (project_group_id);

create or replace function ensure_project_group_matches_household()
returns trigger as $$
declare
  v_group_household uuid;
begin
  if new.project_group_id is null then
    return new;
  end if;

  select household_id
    into v_group_household
  from project_groups
  where id = new.project_group_id;

  if v_group_household is null then
    raise exception 'project group does not exist';
  end if;

  if v_group_household <> new.household_id then
    raise exception 'project group must belong to the same household';
  end if;

  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_projects_group_consistency on projects;
create trigger trg_projects_group_consistency
before insert or update on projects
for each row execute function ensure_project_group_matches_household();

-- 5) Aggregated metrics ----------------------------------------------------------
drop view if exists project_group_metrics;
create or replace view project_group_metrics as
select
  g.id as group_id,
  coalesce(count(distinct p.id), 0) as projects_count,
  coalesce(sum(p.planned_budget), 0) as planned_budget,
  coalesce(sum(p.actual_cost_cached), 0) as actual_cost,
  coalesce(sum(pm.open_todos), 0) as open_todos,
  coalesce(sum(pm.done_todos), 0) as done_todos,
  coalesce(sum(pm.documents_count), 0) as documents_count
from project_groups g
left join projects p on p.project_group_id = g.id
left join project_metrics pm on pm.project_id = p.id
group by g.id;
