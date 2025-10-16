-- supabase/migrations/20251014194239_create_addresses.sql
-- supabase/migrations/20251014195500_create_addresses.sql

create table addresses (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    
    contact_id uuid references contacts(id) on delete cascade,
    structure_id uuid references structures(id) on delete cascade,
    constraint one_parent_check
      check (
        (contact_id is not null and structure_id is null)
        or (contact_id is null and structure_id is not null)
      ),

    address_1 text not null default '',
    address_2 text not null default '',
    zipcode text not null default '',
    city text not null default '',
    country text not null default '',
    label text default '', -- exemple : "domicile", "travail", "résidence secondaire"
    is_primary boolean default false,

    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id)
);

-- Activer la sécurité RLS
alter table addresses enable row level security;

-- Fonction pour mise à jour automatique des métadonnées
create or replace function update_address_metadata()
returns trigger as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$ language plpgsql security definer;

-- Déclencheur sur mise à jour
create trigger set_address_metadata
before update on addresses
for each row
execute function update_address_metadata();

-- RLS policies
create policy "Members can read addresses of their household"
  on addresses for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = addresses.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert addresses into their household"
  on addresses for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = addresses.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update addresses of their household"
  on addresses for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = addresses.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete addresses of their household"
  on addresses for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = addresses.household_id
      and hm.user_id = auth.uid()
    )
  );