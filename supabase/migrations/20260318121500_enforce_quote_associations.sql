-- Helper to assert quotes always linked to contact or structure ----------------
create or replace function assert_quote_has_link(p_interaction_id uuid)
returns void
language plpgsql
as $$
declare
  v_is_quote boolean;
  v_has_contact boolean;
  v_has_structure boolean;
begin
  if p_interaction_id is null then
    return;
  end if;

  select type = 'quote' into v_is_quote
  from interactions
  where id = p_interaction_id;

  if not coalesce(v_is_quote, false) then
    return;
  end if;

  select exists(select 1 from interaction_contacts ic where ic.interaction_id = p_interaction_id)
    into v_has_contact;
  select exists(select 1 from interaction_structures isr where isr.interaction_id = p_interaction_id)
    into v_has_structure;

  if not v_has_contact and not v_has_structure then
    raise exception 'Quote interactions must reference at least one contact or structure';
  end if;
end;
$$;

-- Trigger on interactions insert/update (deferred to end of transaction)
create or replace function trg_interactions_assert_quote_links()
returns trigger
language plpgsql
as $$
begin
  perform assert_quote_has_link(new.id);
  return new;
end;
$$;

drop trigger if exists interactions_assert_quote_links on interactions;
create constraint trigger interactions_assert_quote_links
after insert or update on interactions
deferrable initially deferred
for each row
execute function trg_interactions_assert_quote_links();

-- Trigger for join tables to enforce after deletions --------------------------
create or replace function trg_join_tables_assert_quote_links()
returns trigger
language plpgsql
as $$
declare
  v_interaction_id uuid;
begin
  v_interaction_id := coalesce(new.interaction_id, old.interaction_id);
  perform assert_quote_has_link(v_interaction_id);
  if tg_op = 'DELETE' then
    return old;
  end if;
  return new;
end;
$$;

drop trigger if exists interaction_contacts_assert_quote_links on interaction_contacts;
create constraint trigger interaction_contacts_assert_quote_links
after delete on interaction_contacts
deferrable initially deferred
for each row execute function trg_join_tables_assert_quote_links();

drop trigger if exists interaction_structures_assert_quote_links on interaction_structures;
create constraint trigger interaction_structures_assert_quote_links
after delete on interaction_structures
deferrable initially deferred
for each row execute function trg_join_tables_assert_quote_links();
