-- supabase/migrations/20251014194630_create_structures.sql
-- supabase/migrations/20251014194630_structures.sql
create table structures (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,

    name text not null default '',
    type text default '', -- ex: "banque", "entreprise", "administration", "association"
    description text default '',
    website text default '',
    tags text[] default '{}', -- ex: ["finance", "travaux"]

    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id)
);

alter table structures enable row level security;

create or replace function update_structure_metadata()
returns trigger as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$ language plpgsql security definer;

create trigger set_structure_metadata
before update on structures
for each row
execute function update_structure_metadata();

-- RLS Policies
create policy "Members can read structures of their household"
  on structures for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = structures.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert structures into their household"
  on structures for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = structures.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update structures of their household"
  on structures for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = structures.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete structures of their household"
  on structures for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = structures.household_id
      and hm.user_id = auth.uid()
    )
  );
  