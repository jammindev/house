-- Migration: Create system admin functionality
-- This migration adds system-wide admin roles separate from household membership

-- 1. Create system_admins table to track global administrators
create table if not exists public.system_admins (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin' check (role in ('admin', 'super_admin')),
  granted_by uuid references auth.users(id), -- who granted this admin role
  granted_at timestamptz not null default now(),
  notes text default '',
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  
  -- Ensure one admin record per user
  unique(user_id)
);

-- Enable RLS on system_admins
alter table public.system_admins enable row level security;

-- 2. Create RLS policies for system_admins
-- Only super_admins can view other admins
create policy "Super admins can view all system admins"
  on system_admins for select
  using (
    exists (
      select 1 from system_admins sa
      where sa.user_id = auth.uid() and sa.role = 'super_admin'
    )
  );

-- Only super_admins can create new admins
create policy "Super admins can create system admins"
  on system_admins for insert
  with check (
    exists (
      select 1 from system_admins sa
      where sa.user_id = auth.uid() and sa.role = 'super_admin'
    )
  );

-- Only super_admins can update admin records
create policy "Super admins can update system admins"
  on system_admins for update
  using (
    exists (
      select 1 from system_admins sa
      where sa.user_id = auth.uid() and sa.role = 'super_admin'
    )
  )
  with check (
    exists (
      select 1 from system_admins sa
      where sa.user_id = auth.uid() and sa.role = 'super_admin'
    )
  );

-- Only super_admins can delete admin records (but not their own)
create policy "Super admins can delete other system admins"
  on system_admins for delete
  using (
    exists (
      select 1 from system_admins sa
      where sa.user_id = auth.uid() and sa.role = 'super_admin'
    )
    and user_id != auth.uid() -- Cannot delete self
  );

-- 3. Create helper functions
create or replace function is_system_admin()
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from system_admins
    where user_id = auth.uid()
  );
end;
$$;

create or replace function is_super_admin()
returns boolean
language plpgsql
security definer
stable
as $$
begin
  return exists (
    select 1 from system_admins
    where user_id = auth.uid() and role = 'super_admin'
  );
end;
$$;

create or replace function get_user_admin_role()
returns text
language plpgsql
security definer
stable
as $$
declare
  user_role text;
begin
  select role into user_role
  from system_admins
  where user_id = auth.uid();
  
  return coalesce(user_role, 'user');
end;
$$;

-- 4. Create admin management functions
create or replace function grant_admin_role(
  p_user_id uuid,
  p_role text default 'admin',
  p_notes text default ''
)
returns void
language plpgsql
security definer
as $$
declare
  v_granter uuid;
begin
  v_granter := auth.uid();
  
  -- Only super_admins can grant admin roles
  if not is_super_admin() then
    raise exception 'Only super admins can grant admin roles';
  end if;
  
  -- Validate role
  if p_role not in ('admin', 'super_admin') then
    raise exception 'Invalid role. Must be admin or super_admin';
  end if;
  
  -- Insert or update admin record
  insert into system_admins (user_id, role, granted_by, notes)
  values (p_user_id, p_role, v_granter, p_notes)
  on conflict (user_id) 
  do update set
    role = p_role,
    granted_by = v_granter,
    notes = p_notes,
    updated_at = now();
end;
$$;

create or replace function revoke_admin_role(p_user_id uuid)
returns void
language plpgsql
security definer
as $$
begin
  -- Only super_admins can revoke admin roles
  if not is_super_admin() then
    raise exception 'Only super admins can revoke admin roles';
  end if;
  
  -- Cannot revoke own super_admin role
  if p_user_id = auth.uid() then
    raise exception 'Cannot revoke your own admin role';
  end if;
  
  delete from system_admins where user_id = p_user_id;
end;
$$;

-- 5. Create system stats functions for admin dashboard
create or replace function get_system_stats()
returns json
language plpgsql
security definer
as $$
declare
  stats json;
begin
  -- Only admins can view system stats
  if not is_system_admin() then
    raise exception 'Access denied. Admin privileges required.';
  end if;
  
  select json_build_object(
    'total_users', (select count(*) from auth.users),
    'total_households', (select count(*) from households),
    'total_interactions', (select count(*) from interactions),
    'total_zones', (select count(*) from zones),
    'total_documents', (select count(*) from documents),
    'total_projects', (select count(*) from projects),
    'total_equipment', (select count(*) from equipment),
    'active_users_last_30_days', (
      select count(distinct user_id) 
      from auth.audit_log_entries 
      where created_at > now() - interval '30 days'
    ),
    'new_households_last_30_days', (
      select count(*) 
      from households 
      where created_at > now() - interval '30 days'
    ),
    'storage_usage_mb', (
      select round(sum(metadata->>'size')::numeric / (1024*1024), 2)
      from documents
      where metadata->>'size' is not null
    )
  ) into stats;
  
  return stats;
end;
$$;

-- 6. Grant permissions
grant execute on function is_system_admin() to authenticated;
grant execute on function is_super_admin() to authenticated;
grant execute on function get_user_admin_role() to authenticated;
grant execute on function grant_admin_role(uuid, text, text) to authenticated;
grant execute on function revoke_admin_role(uuid) to authenticated;
grant execute on function get_system_stats() to authenticated;

-- 7. Create trigger for updated_at
create or replace function update_system_admins_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_system_admins_updated_at
  before update on system_admins
  for each row
  execute function update_system_admins_updated_at();

-- 8. Insert initial super_admin (you'll need to update this with your user ID)
-- This is commented out - you should run this manually with your actual user ID
-- insert into system_admins (user_id, role, notes)
-- values ('YOUR_USER_ID_HERE', 'super_admin', 'Initial super admin')
-- on conflict (user_id) do nothing;

-- Note: To get your user ID, run: select auth.uid() after logging in
-- Or check the auth.users table: select id, email from auth.users;