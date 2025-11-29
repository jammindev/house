-- Migration: Create AI chat tables for projects
-- Created at: 2025-11-29 (based on current date)

-- Create project_ai_threads table
create table if not exists project_ai_threads (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references projects(id) on delete cascade,
  household_id uuid not null references households(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  archived_at timestamptz default null
);

-- Add RLS to project_ai_threads
alter table project_ai_threads enable row level security;

-- Create policies for project_ai_threads
-- Users can only access threads in their households that they own
create policy "project_ai_threads_select_policy" on project_ai_threads
  for select 
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = project_ai_threads.household_id
      and hm.user_id = auth.uid()
    ) 
    and user_id = auth.uid()
  );

create policy "project_ai_threads_insert_policy" on project_ai_threads
  for insert 
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = project_ai_threads.household_id
      and hm.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );

create policy "project_ai_threads_update_policy" on project_ai_threads
  for update 
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = project_ai_threads.household_id
      and hm.user_id = auth.uid()
    )
    and user_id = auth.uid()
  )
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = project_ai_threads.household_id
      and hm.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );

create policy "project_ai_threads_delete_policy" on project_ai_threads
  for delete 
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = project_ai_threads.household_id
      and hm.user_id = auth.uid()
    )
    and user_id = auth.uid()
  );

-- Create project_ai_messages table
create table if not exists project_ai_messages (
  id uuid primary key default gen_random_uuid(),
  thread_id uuid not null references project_ai_threads(id) on delete cascade,
  role text not null check (role in ('user', 'assistant', 'system')),
  content text not null,
  metadata jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- Add RLS to project_ai_messages
alter table project_ai_messages enable row level security;

-- Create policies for project_ai_messages
-- Users can only access messages from threads they own in their households
create policy "project_ai_messages_select_policy" on project_ai_messages
  for select 
  using (
    exists (
      select 1 from project_ai_threads t
      join household_members hm on hm.household_id = t.household_id
      where t.id = project_ai_messages.thread_id
      and hm.user_id = auth.uid()
      and t.user_id = auth.uid()
    )
  );

create policy "project_ai_messages_insert_policy" on project_ai_messages
  for insert 
  with check (
    exists (
      select 1 from project_ai_threads t
      join household_members hm on hm.household_id = t.household_id
      where t.id = project_ai_messages.thread_id
      and hm.user_id = auth.uid()
      and t.user_id = auth.uid()
    )
  );

create policy "project_ai_messages_update_policy" on project_ai_messages
  for update 
  using (
    exists (
      select 1 from project_ai_threads t
      join household_members hm on hm.household_id = t.household_id
      where t.id = project_ai_messages.thread_id
      and hm.user_id = auth.uid()
      and t.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1 from project_ai_threads t
      join household_members hm on hm.household_id = t.household_id
      where t.id = project_ai_messages.thread_id
      and hm.user_id = auth.uid()
      and t.user_id = auth.uid()
    )
  );

create policy "project_ai_messages_delete_policy" on project_ai_messages
  for delete 
  using (
    exists (
      select 1 from project_ai_threads t
      join household_members hm on hm.household_id = t.household_id
      where t.id = project_ai_messages.thread_id
      and hm.user_id = auth.uid()
      and t.user_id = auth.uid()
    )
  );

-- Create indexes for performance
create index if not exists idx_project_ai_threads_project_id on project_ai_threads(project_id);
create index if not exists idx_project_ai_threads_household_id on project_ai_threads(household_id);
create index if not exists idx_project_ai_threads_user_id on project_ai_threads(user_id);
create index if not exists idx_project_ai_threads_created_at on project_ai_threads(created_at desc);

create index if not exists idx_project_ai_messages_thread_id on project_ai_messages(thread_id);
create index if not exists idx_project_ai_messages_created_at on project_ai_messages(created_at asc);

-- Trigger to update updated_at on project_ai_threads
create or replace function update_project_ai_threads_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_update_project_ai_threads_updated_at
  before update on project_ai_threads
  for each row execute function update_project_ai_threads_updated_at();