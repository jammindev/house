-- supabase/migrations/20251014194044_create_phones.sql
-- supabase/migrations/20251014194500_create_phones.sql

create table phones (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    
    contact_id uuid references contacts(id) on delete cascade,
    structure_id uuid references structures(id) on delete cascade,
    constraint one_parent_check
      check (
        (contact_id is not null and structure_id is null)
        or (contact_id is null and structure_id is not null)
      ),

    phone text not null,
    label text default '', -- exemple : "mobile", "fixe", "bureau"
    is_primary boolean default false,
    
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id)
);

-- Activer la sécurité RLS
alter table phones enable row level security;

-- Fonction de mise à jour automatique des métadonnées
create or replace function update_phone_metadata()
returns trigger as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$ language plpgsql security definer;

-- Déclencheur : met à jour automatiquement updated_at / updated_by
create trigger set_phone_metadata
before update on phones
for each row
execute function update_phone_metadata();

-- RLS policies
create policy "Members can read phones of their household"
  on phones for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = phones.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert phones into their household"
  on phones for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = phones.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update phones of their household"
  on phones for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = phones.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete phones of their household"
  on phones for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = phones.household_id
      and hm.user_id = auth.uid()
    )
  );
  