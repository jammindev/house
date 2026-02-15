-- Create user_pinned_projects table for per-user project pinning
-- This replaces the household-wide is_pinned boolean on projects

create table if not exists user_pinned_projects (
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid not null references projects(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (user_id, project_id)
);

-- Add index for faster lookups
create index if not exists idx_user_pinned_projects_user_id on user_pinned_projects(user_id);
create index if not exists idx_user_pinned_projects_project_id on user_pinned_projects(project_id);
create index if not exists idx_user_pinned_projects_household_id on user_pinned_projects(household_id);

-- Enable RLS
alter table user_pinned_projects enable row level security;

-- Users can see their own pinned projects
create policy "Users can view their own pinned projects"
  on user_pinned_projects
  for select
  using (auth.uid() = user_id);

-- Users can pin projects in households they belong to
create policy "Users can pin projects in their households"
  on user_pinned_projects
  for insert
  with check (
    auth.uid() = user_id
    and exists (
      select 1 from household_members
      where household_id = user_pinned_projects.household_id
      and user_id = auth.uid()
    )
    and exists (
      select 1 from projects
      where id = user_pinned_projects.project_id
      and household_id = user_pinned_projects.household_id
    )
  );

-- Users can unpin their own projects
create policy "Users can unpin their own projects"
  on user_pinned_projects
  for delete
  using (auth.uid() = user_id);

-- Trigger to ensure household_id consistency
create or replace function check_user_pinned_projects_household_consistency()
returns trigger as $$
begin
  -- Verify that the project belongs to the household
  if not exists (
    select 1 from projects
    where id = new.project_id
    and household_id = new.household_id
  ) then
    raise exception 'Project does not belong to the specified household';
  end if;
  
  -- Verify that the user is a member of the household
  if not exists (
    select 1 from household_members
    where household_id = new.household_id
    and user_id = new.user_id
  ) then
    raise exception 'User is not a member of the specified household';
  end if;
  
  return new;
end;
$$ language plpgsql security definer;

create trigger trg_check_user_pinned_projects_consistency
  before insert or update on user_pinned_projects
  for each row
  execute function check_user_pinned_projects_household_consistency();

-- Migrate existing pinned projects to user_pinned_projects
-- For each pinned project, create a pin for all household members
-- This ensures backward compatibility (all members will see previously pinned projects)
insert into user_pinned_projects (user_id, project_id, household_id)
select distinct
  hm.user_id,
  p.id as project_id,
  p.household_id
from projects p
join household_members hm on hm.household_id = p.household_id
where p.is_pinned = true
on conflict (user_id, project_id) do nothing;

-- Comment on the table
comment on table user_pinned_projects is 'Tracks which projects each user has pinned to their dashboard. Replaces the household-wide is_pinned field.';
comment on column user_pinned_projects.user_id is 'The user who pinned the project';
comment on column user_pinned_projects.project_id is 'The project that was pinned';
comment on column user_pinned_projects.household_id is 'The household the project belongs to (for consistency and faster queries)';
