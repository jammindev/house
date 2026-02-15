-- Add project_documents join table for linking documents to projects
-- This enables rich context capture during project creation

-- Create project_documents table
create table if not exists project_documents (
  project_id uuid not null references projects(id) on delete cascade,
  document_id uuid not null references documents(id) on delete cascade,
  role text not null default 'supporting',
  note text default '',
  created_at timestamptz not null default now(),
  created_by uuid references auth.users(id),
  primary key (project_id, document_id)
);

-- Enable RLS
alter table project_documents enable row level security;

-- RLS policies: household members can manage project documents
create policy "household_members_select_project_documents"
  on project_documents for select
  using (
    exists (
      select 1 from projects p
      inner join household_members hm on hm.household_id = p.household_id
      where p.id = project_documents.project_id
        and hm.user_id = auth.uid()
    )
  );

create policy "household_members_insert_project_documents"
  on project_documents for insert
  with check (
    exists (
      select 1 from projects p
      inner join household_members hm on hm.household_id = p.household_id
      where p.id = project_documents.project_id
        and hm.user_id = auth.uid()
    )
  );

create policy "household_members_update_project_documents"
  on project_documents for update
  using (
    exists (
      select 1 from projects p
      inner join household_members hm on hm.household_id = p.household_id
      where p.id = project_documents.project_id
        and hm.user_id = auth.uid()
    ) 
  );

create policy "household_members_delete_project_documents"
  on project_documents for delete
  using (
    exists (
      select 1 from projects p
      inner join household_members hm on hm.household_id = p.household_id
      where p.id = project_documents.project_id
        and hm.user_id = auth.uid()
    )
  );

-- Trigger to populate created_by
create or replace function set_project_document_created_by()
returns trigger as $$
begin
  NEW.created_by := auth.uid();
  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_set_project_document_created_by
  before insert on project_documents
  for each row
  execute function set_project_document_created_by();

-- Trigger to ensure document and project belong to same household
create or replace function validate_project_document_household()
returns trigger as $$
declare
  v_project_household_id uuid;
  v_document_household_id uuid;
begin
  -- Get project's household
  select household_id into v_project_household_id
  from projects
  where id = NEW.project_id;

  -- Get document's household directly
  select household_id into v_document_household_id
  from documents
  where id = NEW.document_id;

  -- Validate households match
  if v_project_household_id is null then
    raise exception 'Project not found';
  end if;

  if v_document_household_id is null then
    raise exception 'Document not found';
  end if;

  if v_project_household_id != v_document_household_id then
    raise exception 'Document and project must belong to same household';
  end if;

  return NEW;
end;
$$ language plpgsql security definer;

create trigger trg_validate_project_document_household
  before insert or update on project_documents
  for each row
  execute function validate_project_document_household();

-- Add index for better query performance
create index idx_project_documents_project_id on project_documents(project_id);
create index idx_project_documents_document_id on project_documents(document_id);

-- Note: Documents table uses household_id directly and links to interactions/projects via join tables
-- No need to modify the documents table structure itself
