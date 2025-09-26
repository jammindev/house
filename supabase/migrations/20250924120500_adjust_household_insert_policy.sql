-- Ensure authenticated users can create households without service-role privileges
-- by relaxing the insert policy check (the RPC enforces authentication explicitly).

drop policy if exists "Users can create households" on households;

create policy "Users can create households"
  on households for insert
  with check (true);
