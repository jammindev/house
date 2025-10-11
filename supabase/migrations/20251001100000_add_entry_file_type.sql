-- Add type column to entry_files to classify attachments
alter table entry_files
  add column type text;

-- Backfill existing rows using MIME type heuristic
update entry_files
set type = case
  when mime_type ilike 'image/%' then 'photo'
  else 'document'
end;

-- Enforce allowed values and defaults
alter table entry_files
  alter column type set default 'document',
  alter column type set not null,
  add constraint entry_files_type_check check (type in ('document', 'photo'));
