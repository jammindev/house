-- Add parent-child relationship to zones (without subqueries in CHECK)
-- 1) Add parent_id column safely
do $$ begin
  alter table zones add column parent_id uuid;
exception when duplicate_column then null; end $$;

-- 2) Ensure a unique constraint exists on (id, household_id) so we can reference both
do $$ begin
  alter table zones add constraint zones_id_household_unique unique (id, household_id);
exception when duplicate_object then null; end $$;

-- 3) Enforce parent in same household via composite foreign key
do $$ begin
  alter table zones add constraint zones_parent_same_household_fk
    foreign key (parent_id, household_id)
    references zones(id, household_id)
    on delete set null;
exception when duplicate_object then null; end $$;

-- 4) Helpful index on parent_id
create index if not exists idx_zones_parent_id on zones(parent_id);
