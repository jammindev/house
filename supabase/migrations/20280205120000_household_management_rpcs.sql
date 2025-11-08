-- RPC functions for household management

-- Function to leave a household (remove membership)
create or replace function leave_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
  v_owner_count int;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  -- Check if user is a member of this household
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_user
  ) then
    raise exception 'You are not a member of this household';
  end if;

  -- Count remaining owners after this user leaves
  select count(*)
  into v_owner_count
  from household_members
  where household_id = p_household_id
    and role = 'owner'
    and user_id != v_user;

  -- If this is the last owner, prevent leaving
  if exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_user and role = 'owner'
  ) and v_owner_count = 0 then
    raise exception 'Cannot leave household as the last owner. Delete the household instead or assign another owner.';
  end if;

  -- Remove the membership
  delete from household_members
  where household_id = p_household_id and user_id = v_user;
end;
$$;

-- Function to delete a household (only for owners)
create or replace function delete_household(p_household_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  -- Check if user is an owner of this household
  if not exists (
    select 1 from household_members
    where household_id = p_household_id and user_id = v_user and role = 'owner'
  ) then
    raise exception 'Only household owners can delete the household';
  end if;

  -- Delete the household (cascade will handle all related data)
  delete from households where id = p_household_id;
end;
$$;

-- Function to get household members with their details
create or replace function get_household_members(p_household_id uuid)
returns table (
  user_id uuid,
  user_email text,
  user_display_name text,
  role text,
  joined_at timestamptz
)
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  -- Check if user is a member of this household
  if not exists (
    select 1 from household_members hm
    where hm.household_id = p_household_id and hm.user_id = v_user
  ) then
    raise exception 'You are not a member of this household';
  end if;

  return query
  select 
    hm.user_id,
    u.email::text,
    coalesce(u.raw_user_meta_data->>'display_name', u.email)::text as user_display_name,
    hm.role,
    h.created_at as joined_at
  from household_members hm
  join auth.users u on u.id = hm.user_id
  join households h on h.id = hm.household_id
  where hm.household_id = p_household_id
  order by hm.role desc, u.email;
end;
$$;

-- Grant execute permissions
grant execute on function leave_household(uuid) to authenticated;
grant execute on function delete_household(uuid) to authenticated;
grant execute on function get_household_members(uuid) to authenticated;