-- Create entries table
create table entries (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households(id) on delete cascade,

  -- Contenu
  raw_text text not null,
  enriched_text text,
  metadata jsonb default '{}'::jsonb,

  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  created_by uuid references auth.users(id) not null,
  updated_by uuid references auth.users(id)
);

alter table entries enable row level security;

-- Trigger pour mettre à jour updated_at et updated_by automatiquement
create or replace function update_entry_metadata()
returns trigger as $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$ language plpgsql security definer;

create trigger set_entry_metadata
before update on entries
for each row
execute function update_entry_metadata();

-- RLS policies
create policy "Members can read entries of their household"
  on entries for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert entries into their household"
  on entries for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update entries of their household"
  on entries for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete entries of their household"
  on entries for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id
      and hm.user_id = auth.uid()
    )
  );
