-- Table de jointure entries <-> zones
create table entry_zones (
  entry_id uuid not null references entries(id) on delete cascade,
  zone_id uuid not null references zones(id) on delete cascade,
  primary key (entry_id, zone_id)
);

alter table entry_zones enable row level security;

-- Policies pour entry_zones
create policy "Members can manage entry_zones of their household"
  on entry_zones for all
  using (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_zones.entry_id
      and hm.user_id = auth.uid()
    )
  )
  with check (
    exists (
      select 1
      from entries e
      join household_members hm on hm.household_id = e.household_id
      where e.id = entry_zones.entry_id
      and hm.user_id = auth.uid()
    )
  );
