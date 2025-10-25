-- Ensure interactions.type allows the new quote variant -----------------------
do $$
begin
  if exists (select 1 from pg_constraint where conname = 'interactions_type_check') then
    execute 'alter table interactions drop constraint interactions_type_check';
  end if;
end $$;

alter table interactions
  add constraint interactions_type_check
    check (type in ('note','todo','call','meeting','document','expense','message','signature','other','quote'));
