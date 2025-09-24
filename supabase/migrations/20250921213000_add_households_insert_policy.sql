-- Allow authenticated users to create households
create policy "Users can create households"
  on households for insert
  with check (auth.uid() is not null);

