-- RPC to create a household and enroll the caller as owner atomically
create or replace function create_household_with_owner(p_name text)
returns uuid
language plpgsql
as $$
declare
  v_user uuid;
  v_household_id uuid;
  v_name text;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  v_name := btrim(coalesce(p_name, ''));
  if v_name = '' then
    raise exception 'Name is required';
  end if;

  insert into households (name)
  values (v_name)
  returning id into v_household_id;

  insert into household_members (household_id, user_id, role)
  values (v_household_id, v_user, 'owner');

  return v_household_id;
end;
$$;
