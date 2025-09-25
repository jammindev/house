-- entry_files table for attachments linked to entries
create table entry_files (
  id uuid primary key default gen_random_uuid(),
  entry_id uuid not null references entries(id) on delete cascade,
  storage_path text not null,
  mime_type text,
  ocr_text text,
  metadata jsonb default '{}'::jsonb,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id) not null
);

alter table entry_files enable row level security;

-- Members of the entry's household can select/insert/update/delete
create policy "Members can select entry_files of their household"
  on entry_files for select
  using (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_files.entry_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can insert entry_files in their household"
  on entry_files for insert
  with check (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_files.entry_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update entry_files of their household"
  on entry_files for update
  using (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_files.entry_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can delete entry_files of their household"
  on entry_files for delete
  using (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_files.entry_id
        and hm.user_id = auth.uid()
    )
  );

