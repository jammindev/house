-- supabase/migrations/20251014191544_create_contacts.sql
create table contacts (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    structure_id uuid references structures(id) on delete set null,

    first_name text not null default '',
    last_name text not null default '',
    position text default '', -- fonction : ex "Directeur d’agence", "Plombier"
    notes text default '',

    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id)
);

alter table contacts enable row level security;

create or replace function update_contact_metadata()
returns trigger as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$ language plpgsql security definer;

create trigger set_contact_metadata
before update on contacts
for each row
execute function update_contact_metadata();

-- RLS Policies
create policy "Members can read contacts of their household"
  on contacts for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = contacts.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert contacts into their household"
  on contacts for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = contacts.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update contacts of their household"
  on contacts for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = contacts.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete contacts of their household"
  on contacts for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = contacts.household_id
      and hm.user_id = auth.uid()
    )
  );