-- Ensure created_by is auto-populated with auth.uid() on insert
create or replace function set_entry_file_created_by()
returns trigger as $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists trg_entry_files_set_created_by on entry_files;
create trigger trg_entry_files_set_created_by
before insert on entry_files
for each row
execute function set_entry_file_created_by();

