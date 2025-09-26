-- Allow any household member to delete entries (not just creator)

drop policy if exists "entries_delete_owner_only" on entries;

do $$ begin
  drop policy if exists "Members can delete entries of their household" on entries;
exception when others then null; end $$;

create policy "Members can delete entries of their household"
  on entries for delete
  using (
    exists (
      select 1 from household_members hm
      where hm.household_id = entries.household_id
        and hm.user_id = auth.uid()
    )
  );
