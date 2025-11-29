-- Adds a pin flag on projects so households can highlight key initiatives
alter table public.projects
    add column if not exists is_pinned boolean not null default false;

comment on column public.projects.is_pinned is 'When true the project is highlighted and surfaced in the dashboard.';
