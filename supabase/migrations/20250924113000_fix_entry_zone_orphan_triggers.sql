-- Fix: Allow deleting an entry while still enforcing that surviving entries keep at least one zone
-- Strategy: move checks to AFTER DELETE/UPDATE and skip enforcement when the parent entry no longer exists

-- Drop previous BEFORE triggers/functions if present
do $$ begin
  execute 'drop trigger if exists trg_prevent_orphan_entry_on_ez_delete on entry_zones';
exception when others then null; end $$;

do $$ begin
  execute 'drop trigger if exists trg_prevent_orphan_entry_on_ez_update on entry_zones';
exception when others then null; end $$;

do $$ begin
  execute 'drop function if exists prevent_orphan_entry_on_ez_delete()';
exception when others then null; end $$;

do $$ begin
  execute 'drop function if exists prevent_orphan_entry_on_ez_update()';
exception when others then null; end $$;

-- AFTER DELETE: only enforce if the entry still exists
create or replace function enforce_entry_has_zone_after_delete()
returns trigger as $$
declare
  remaining int;
  entry_present boolean;
begin
  select exists (select 1 from entries e where e.id = old.entry_id) into entry_present;
  if not entry_present then
    return old; -- entry is being deleted (cascade); allow
  end if;

  select count(*) into remaining from entry_zones where entry_id = old.entry_id;
  if remaining = 0 then
    raise exception 'Entry must have at least one zone';
  end if;
  return old;
end;
$$ language plpgsql;

create trigger trg_enforce_entry_has_zone_after_delete
after delete on entry_zones
for each row execute function enforce_entry_has_zone_after_delete();

-- AFTER UPDATE of entry_id: enforce that the old entry still has at least one zone
create or replace function enforce_entry_has_zone_after_update()
returns trigger as $$
declare
  remaining int;
  entry_present boolean;
begin
  if old.entry_id is distinct from new.entry_id then
    select exists (select 1 from entries e where e.id = old.entry_id) into entry_present;
    if entry_present then
      select count(*) into remaining from entry_zones where entry_id = old.entry_id;
      if remaining = 0 then
        raise exception 'Entry must have at least one zone';
      end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_enforce_entry_has_zone_after_update
after update on entry_zones
for each row execute function enforce_entry_has_zone_after_update();

