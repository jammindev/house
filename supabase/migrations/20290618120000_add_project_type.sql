-- supabase/migrations/20260618120000_add_project_type.sql
-- Introduce project type metadata for UI defaults and presentation.

alter table projects
  add column if not exists type text;

update projects
set type = 'other'
where type is null
   or btrim(type) = ''
   or type not in (
    'renovation',
    'maintenance',
    'repair',
    'purchase',
    'relocation',
    'vacation',
    'leisure',
    'other'
  );

alter table projects
  alter column type set default 'other';

alter table projects
  alter column type set not null;

alter table projects
  drop constraint if exists projects_type_check;

alter table projects
  add constraint projects_type_check
  check (
    type in (
      'renovation',
      'maintenance',
      'repair',
      'purchase',
      'relocation',
      'vacation',
      'leisure',
      'other'
    )
  );
