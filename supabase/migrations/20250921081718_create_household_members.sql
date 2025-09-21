create table household_members (
  household_id uuid references households(id) on delete cascade,
  user_id uuid references auth.users(id) on delete cascade,
  role text default 'member',
  primary key (household_id, user_id)
);

alter table household_members enable row level security;

create policy "Users can view their household memberships"
  on household_members for select
  using (user_id = auth.uid());

create policy "Users can join a household"
  on household_members for insert
  with check (user_id = auth.uid());

-- ✅ maintenant que household_members existe, on peut ajouter cette policy
create policy "Users can view households they belong to"
  on households for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = households.id
      and hm.user_id = auth.uid()
    )
  );
