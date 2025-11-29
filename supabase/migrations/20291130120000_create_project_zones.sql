-- Table de jointure projects <-> zones
create table project_zones (
  project_id uuid not null references projects(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id),
  primary key (project_id, zone_id)
);

alter table project_zones enable row level security;

-- Trigger pour définir created_by
create or replace function set_project_zones_created_by()
returns trigger as $$
begin
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_project_zones_set_created_by
  before insert on project_zones
  for each row execute function set_project_zones_created_by();

-- Trigger pour s'assurer que le projet et la zone appartiennent au même household
create or replace function enforce_project_zone_household_consistency()
returns trigger as $$
begin
  if not exists (
    select 1
    from projects p
    join zones z on z.household_id = p.household_id
    where p.id = NEW.project_id
    and z.id = NEW.zone_id
  ) then
    raise exception 'Project and zone must belong to the same household';
  end if;
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_project_zones_household_consistency
  before insert or update on project_zones
  for each row execute function enforce_project_zone_household_consistency();

-- Policies pour project_zones
create policy "Members can view project_zones of their household"
  on project_zones for select
  using (
    exists (
      select 1
      from projects p
      join household_members hm on hm.household_id = p.household_id
      where p.id = project_zones.project_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert project_zones of their household"
  on project_zones for insert
  with check (
    exists (
      select 1
      from projects p
      join household_members hm on hm.household_id = p.household_id
      where p.id = project_zones.project_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update project_zones of their household"
  on project_zones for update
  using (
    exists (
      select 1
      from projects p
      join household_members hm on hm.household_id = p.household_id
      where p.id = project_zones.project_id
      and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from projects p
      join household_members hm on hm.household_id = p.household_id
      where p.id = project_zones.project_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete project_zones of their household"
  on project_zones for delete
  using (
    exists (
      select 1
      from projects p
      join household_members hm on hm.household_id = p.household_id
      where p.id = project_zones.project_id
      and hm.user_id = auth.uid()
    )
  );