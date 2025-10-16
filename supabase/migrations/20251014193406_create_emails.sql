-- supabase/migrations/20251014193406_create_emails.sql

create table emails (
    id uuid primary key default gen_random_uuid(),
    household_id uuid not null references households(id) on delete cascade,
    
    contact_id uuid references contacts(id) on delete cascade,
    structure_id uuid references structures(id) on delete cascade,
    constraint one_parent_check
      check (
        (contact_id is not null and structure_id is null)
        or (contact_id is null and structure_id is not null)
      ),

    email text not null,
    label text default '', -- exemple : "pro", "perso"
    is_primary boolean default false,
    
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    created_by uuid not null references auth.users(id),
    updated_by uuid references auth.users(id)
);

-- Sécurité RLS
alter table emails enable row level security;

-- Fonction pour mettre à jour automatiquement updated_at / updated_by
create or replace function update_email_metadata()
returns trigger as $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$ language plpgsql security definer;

-- Déclencheur sur mise à jour
create trigger set_email_metadata
before update on emails
for each row
execute function update_email_metadata();

-- RLS policies
create policy "Members can read emails of their household"
  on emails for select
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = emails.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert emails into their household"
  on emails for insert
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = emails.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can update emails of their household"
  on emails for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = emails.household_id
      and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete emails of their household"
  on emails for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = emails.household_id
      and hm.user_id = auth.uid()
    )
  );