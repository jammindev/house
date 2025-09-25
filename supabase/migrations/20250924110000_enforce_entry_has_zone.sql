-- Prevent entries from ending up without any zone link

create or replace function prevent_orphan_entry_on_ez_delete()
returns trigger as $$
declare
  remaining int;
begin
  select count(*) into remaining from entry_zones where entry_id = old.entry_id and not (entry_id = old.entry_id and zone_id = old.zone_id);
  if remaining = 0 then
    raise exception 'Entry must have at least one zone';
  end if;
  return old;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_orphan_entry_on_ez_delete on entry_zones;
create trigger trg_prevent_orphan_entry_on_ez_delete
before delete on entry_zones
for each row execute function prevent_orphan_entry_on_ez_delete();

-- Also handle updates that move the link to another entry (rare)
create or replace function prevent_orphan_entry_on_ez_update()
returns trigger as $$
declare
  remaining int;
begin
  if old.entry_id is distinct from new.entry_id then
    select count(*) into remaining from entry_zones where entry_id = old.entry_id and not (entry_id = old.entry_id and zone_id = old.zone_id);
    if remaining = 0 then
      raise exception 'Entry must have at least one zone';
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_prevent_orphan_entry_on_ez_update on entry_zones;
create trigger trg_prevent_orphan_entry_on_ez_update
before update on entry_zones
for each row execute function prevent_orphan_entry_on_ez_update();

