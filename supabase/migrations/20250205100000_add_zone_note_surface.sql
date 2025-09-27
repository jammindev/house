alter table public.zones
  add column note text;

alter table public.zones
  add column surface numeric check (surface >= 0);
