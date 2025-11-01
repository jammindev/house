-- supabase/migrations/20280101120000_add_pinterest_board_to_projects.sql
-- Add pinterest_board_url field to projects table

alter table projects
  add column if not exists pinterest_board_url text;

comment on column projects.pinterest_board_url is 'Optional URL to a Pinterest board associated with this project';
