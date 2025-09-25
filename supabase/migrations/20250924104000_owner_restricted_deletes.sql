-- Zones: add created_by and trigger; restrict deletes to creator
do $$ begin
  alter table zones add column created_by uuid references auth.users(id);
exception when duplicate_column then null; end $$;

create or replace function set_zone_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_zones_set_created_by on zones;
create trigger trg_zones_set_created_by
before insert on zones
for each row
execute function set_zone_created_by();

-- Replace broad zones policy with granular ones
do $$ begin
  drop policy if exists "Users can manage zones in their household" on zones;
exception when others then null; end $$;

create policy "zones_select_members"
  on zones for select
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = zones.household_id and hm.user_id = auth.uid()
    )
  );

create policy "zones_insert_members"
  on zones for insert
  with check (
    exists (
      select 1 from household_members hm
      where hm.household_id = zones.household_id and hm.user_id = auth.uid()
    )
  );

create policy "zones_update_members"
  on zones for update
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = zones.household_id and hm.user_id = auth.uid()
    )
  );

create policy "zones_delete_owner_only"
  on zones for delete
  using (
    zones.created_by = auth.uid() and exists (
      select 1 from household_members hm
      where hm.household_id = zones.household_id and hm.user_id = auth.uid()
    )
  );

-- Entries: restrict delete to creator (keep select/insert/update as before)
do $$ begin
  drop policy if exists "Members can delete entries of their household" on entries;
exception when others then null; end $$;

create policy "entries_delete_owner_only"
  on entries for delete
  using (
    entries.created_by = auth.uid() and exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id and hm.user_id = auth.uid()
    )
  );

