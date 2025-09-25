-- Create an RPC to atomically create an entry with at least one zone
-- Ensures: user is authenticated, is a member of the household, all zones belong to that household

create or replace function create_entry_with_zones(
  p_household_id uuid,
  p_raw_text text,
  p_zone_ids uuid[]
)
returns uuid
language plpgsql
as $$
declare
  v_user uuid;
  v_count int;
  v_entry_id uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  if p_raw_text is null or length(btrim(p_raw_text)) = 0 then
    raise exception 'raw_text is required';
  end if;

  if p_zone_ids is null or array_length(p_zone_ids, 1) is null then
    raise exception 'At least one zone is required';
  end if;

  -- Must be a member of the household
  select count(*) into v_count
  from household_members hm
  where hm.household_id = p_household_id and hm.user_id = v_user;
  if v_count = 0 then
    raise exception 'Not a member of household';
  end if;

  -- All zones must belong to the same household
  select count(*) into v_count
  from zones z
  where z.household_id = p_household_id and z.id = any(p_zone_ids);
  if v_count <> coalesce(array_length(p_zone_ids, 1), 0) then
    raise exception 'All zones must belong to the same household';
  end if;

  -- Insert the entry (RLS enforces membership)
  insert into entries (household_id, raw_text, created_by)
  values (p_household_id, p_raw_text, v_user)
  returning id into v_entry_id;

  -- Link zones
  insert into entry_zones(entry_id, zone_id)
  select v_entry_id, z_id from unnest(p_zone_ids) as z_id;

  return v_entry_id;
end;
$$;

