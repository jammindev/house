-- Allow any household member (including owners) to delete zones

drop policy if exists "zones_delete_owner_only" on zones;

do $$ begin
  drop policy if exists "Users can delete zones in their household" on zones;
exception when others then null; end $$;

create policy "zones_delete_members"
  on zones for delete
  using (
    exists (
      select 1
      from household_members hm
      where hm.household_id = zones.household_id
        and hm.user_id = auth.uid()
    )
  );
