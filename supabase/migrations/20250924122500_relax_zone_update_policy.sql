-- Allow any household member to update zones

drop policy if exists "zones_update_members" on zones;

create policy "zones_update_members"
  on zones for update
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = zones.household_id
        and hm.user_id = auth.uid()
    )
  );

create policy "zones_update_members_with_check"
  on zones for update
  with check (
    exists (
      select 1
      from household_members hm
      where hm.household_id = zones.household_id
        and hm.user_id = auth.uid()
    )
  );
