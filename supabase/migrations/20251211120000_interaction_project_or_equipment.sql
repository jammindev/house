-- Ensure an interaction cannot be linked to both a project and an equipment

-- Prevent linking equipment when the interaction already references a project
create or replace function public.prevent_equipment_link_when_project()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_project_id uuid;
begin
    select project_id into v_project_id from interactions where id = coalesce(new.interaction_id, old.interaction_id);
    if v_project_id is not null then
        raise exception 'Interaction cannot be linked to equipment when a project is already set';
    end if;
    return new;
end;
$$;

drop trigger if exists trg_equipment_interactions_project_guard on public.equipment_interactions;
create trigger trg_equipment_interactions_project_guard
before insert or update on public.equipment_interactions
for each row
execute function public.prevent_equipment_link_when_project();

-- Prevent setting a project when equipment links already exist
create or replace function public.prevent_project_when_equipment_linked()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
    v_count integer;
begin
    if new.project_id is null then
        return new;
    end if;

    select count(*) into v_count from equipment_interactions where interaction_id = new.id;
    if v_count > 0 then
        raise exception 'Interaction cannot be linked to a project when equipment links exist';
    end if;

    return new;
end;
$$;

drop trigger if exists trg_interactions_project_guard on public.interactions;
create trigger trg_interactions_project_guard
before insert or update on public.interactions
for each row
when (new.project_id is not null)
execute function public.prevent_project_when_equipment_linked();
