create table zones (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households(id) on delete cascade,
  name text not null,
  created_at timestamptz default now()
);

alter table zones enable row level security;

create policy "Users can manage zones in their household"
  on zones for all
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = zones.household_id
      and hm.user_id = auth.uid()
    )
  );
