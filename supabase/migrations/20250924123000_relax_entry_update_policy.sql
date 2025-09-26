-- Ensure any household member can update entries they have access to

drop policy if exists "Members can update entries of their household" on entries;

create policy "Members can update entries of their household"
  on entries for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = entries.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "Members can update entries with check"
  on entries for update
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = entries.household_id
        and hm.user_id = auth.uid()
    )
  );
