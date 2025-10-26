-- supabase/migrations/20260430110000_make_interaction_description_optional.sql
-- We track interaction “descriptions” in the content column today, so we
-- ensure that column always defaults to an empty string instead of null.

update interactions
set content = ''
where content is null;

alter table interactions
  alter column content set default '';
