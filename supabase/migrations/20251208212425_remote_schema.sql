


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "authenticative";


ALTER SCHEMA "authenticative" OWNER TO "postgres";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE EXTENSION IF NOT EXISTS "pg_graphql" WITH SCHEMA "graphql";






CREATE EXTENSION IF NOT EXISTS "pg_stat_statements" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "pgcrypto" WITH SCHEMA "extensions";






CREATE EXTENSION IF NOT EXISTS "supabase_vault" WITH SCHEMA "vault";






CREATE EXTENSION IF NOT EXISTS "uuid-ossp" WITH SCHEMA "extensions";






CREATE TYPE "public"."email_processing_status" AS ENUM (
    'pending',
    'processing',
    'completed',
    'failed',
    'ignored'
);


ALTER TYPE "public"."email_processing_status" OWNER TO "postgres";


CREATE TYPE "public"."project_status" AS ENUM (
    'draft',
    'active',
    'on_hold',
    'completed',
    'cancelled'
);


ALTER TYPE "public"."project_status" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "authenticative"."is_user_authenticated"() RETURNS boolean
    LANGUAGE "sql" SECURITY DEFINER
    AS $$
  SELECT array[(select auth.jwt()->>'aal')] <@ (
    SELECT
      CASE
        WHEN count(id) > 0 THEN array['aal2']
        ELSE array['aal1', 'aal2']
      END as aal
    FROM auth.mfa_factors
    WHERE (auth.uid() = user_id)
    AND status = 'verified'
  );
$$;


ALTER FUNCTION "authenticative"."is_user_authenticated"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."assert_quote_has_link"("p_interaction_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."assert_quote_has_link"("p_interaction_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."auto_generate_household_email_alias"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    IF NEW.inbound_email_alias IS NULL THEN
        NEW.inbound_email_alias := generate_household_email_alias(NEW.id);
    END IF;
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."auto_generate_household_email_alias"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_entry_with_zones"("p_household_id" "uuid", "p_raw_text" "text", "p_zone_ids" "uuid"[]) RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_subject text;
begin
  v_subject := coalesce(nullif(trim(p_raw_text), ''), 'Untitled interaction');
  return create_interaction_with_zones(
    p_household_id,
    v_subject,
    p_zone_ids,
    coalesce(p_raw_text, ''),
    'note',
    null,
    null,
    null,
    null,
    null,
    null,
    '{}'::jsonb
  );
end;
$$;


ALTER FUNCTION "public"."create_entry_with_zones"("p_household_id" "uuid", "p_raw_text" "text", "p_zone_ids" "uuid"[]) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_household_with_owner"("p_name" "text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."create_household_with_owner"("p_name" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_household_with_owner"("p_name" "text", "p_address" "text" DEFAULT ''::"text", "p_city" "text" DEFAULT ''::"text", "p_country" "text" DEFAULT ''::"text", "p_context_notes" "text" DEFAULT ''::"text", "p_ai_prompt_context" "text" DEFAULT ''::"text") RETURNS "uuid"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
DECLARE
    v_user uuid;
    v_household_id uuid;
    v_name text;
BEGIN
    v_user := auth.uid();
    IF v_user IS NULL THEN
        RAISE EXCEPTION 'Unauthorized';
    END IF;

    v_name := btrim(coalesce(p_name, ''));
    IF v_name = '' THEN
        RAISE EXCEPTION 'Name is required';
    END IF;

    INSERT INTO households (name, address, city, country, context_notes, ai_prompt_context)
    VALUES (v_name, p_address, p_city, p_country, p_context_notes, p_ai_prompt_context)
    RETURNING id INTO v_household_id;

    INSERT INTO household_members (household_id, user_id, role)
    VALUES (v_household_id, v_user, 'owner');

    RETURN v_household_id;
END;
$$;


ALTER FUNCTION "public"."create_household_with_owner"("p_name" "text", "p_address" "text", "p_city" "text", "p_country" "text", "p_context_notes" "text", "p_ai_prompt_context" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text" DEFAULT ''::"text", "p_type" "text" DEFAULT 'note'::"text", "p_status" "text" DEFAULT NULL::"text", "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_tag_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_contact_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_structure_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_project_id" "uuid" DEFAULT NULL::"uuid", "p_metadata" "jsonb" DEFAULT '{}'::"jsonb") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
  v_count int;
  v_interaction_id uuid;
  v_allowed_types constant text[] := ARRAY[
    'note','todo','call','meeting','document','expense','message','signature','other',
    'quote','visit','visite',
    'maintenance','repair','installation','inspection','warranty','issue','upgrade','replacement','disposal'
  ];
  v_allowed_status constant text[] := ARRAY['pending','in_progress','done','archived'];
  v_effective_occurred_at timestamptz;
  v_effective_tag_ids uuid[];
  v_effective_contact_ids uuid[];
  v_effective_structure_ids uuid[];
  v_project_household uuid;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
begin
  v_user := auth.uid();
  if v_user is null then
    raise exception 'Unauthorized';
  end if;

  if p_subject is null or length(btrim(p_subject)) = 0 then
    raise exception 'subject is required';
  end if;

  if p_zone_ids is null or array_length(p_zone_ids, 1) is null then
    raise exception 'At least one zone is required';
  end if;

  if not (p_type = any(v_allowed_types)) then
    raise exception 'Invalid interaction type';
  end if;

  if p_status is not null and not (p_status = any(v_allowed_status)) then
    raise exception 'Invalid interaction status';
  end if;

  v_effective_occurred_at := coalesce(p_occurred_at, now());
  v_effective_tag_ids := coalesce(p_tag_ids, ARRAY[]::uuid[]);
  v_effective_contact_ids := coalesce(p_contact_ids, ARRAY[]::uuid[]);
  v_effective_structure_ids := coalesce(p_structure_ids, ARRAY[]::uuid[]);

  if array_length(v_effective_tag_ids, 1) is not null then
    select array_agg(distinct tag_id)
      into v_effective_tag_ids
    from unnest(v_effective_tag_ids) as t(tag_id);
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    select array_agg(distinct contact_id)
      into v_effective_contact_ids
    from unnest(v_effective_contact_ids) as c(contact_id);
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    select array_agg(distinct structure_id)
      into v_effective_structure_ids
    from unnest(v_effective_structure_ids) as s(structure_id);
  end if;

  select count(*) into v_count
  from household_members hm
  where hm.household_id = p_household_id
    and hm.user_id = v_user;
  if v_count = 0 then
    raise exception 'Not a member of household';
  end if;

  select count(*) into v_count
  from zones z
  where z.household_id = p_household_id
    and z.id = any(p_zone_ids);
  if v_count <> coalesce(array_length(p_zone_ids, 1), 0) then
    raise exception 'All zones must belong to the same household';
  end if;

  if array_length(v_effective_tag_ids, 1) is not null then
    select count(*) into v_count
    from tags t
    where t.household_id = p_household_id
      and t.type = 'interaction'
      and t.id = any(v_effective_tag_ids);
    if v_count <> array_length(v_effective_tag_ids, 1) then
      raise exception 'Tags must belong to the household and be interaction tags';
    end if;
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    select count(*) into v_count
    from contacts c
    where c.household_id = p_household_id
      and c.id = any(v_effective_contact_ids);
    if v_count <> array_length(v_effective_contact_ids, 1) then
      raise exception 'Contacts must belong to the household';
    end if;
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    select count(*) into v_count
    from structures s
    where s.household_id = p_household_id
      and s.id = any(v_effective_structure_ids);
    if v_count <> array_length(v_effective_structure_ids, 1) then
      raise exception 'Structures must belong to the household';
    end if;
  end if;

  if p_project_id is not null then
    select household_id into v_project_household
    from projects
    where id = p_project_id;

    if v_project_household is null then
      raise exception 'Project does not exist';
    end if;

    if v_project_household <> p_household_id then
      raise exception 'Project must belong to the household';
    end if;
  end if;

  insert into interactions (
    household_id,
    subject,
    content,
    type,
    status,
    occurred_at,
    metadata,
    enriched_text,
    created_by,
    project_id
  )
  values (
    p_household_id,
    trim(p_subject),
    coalesce(p_content, ''),
    p_type,
    p_status,
    v_effective_occurred_at,
    v_metadata,
    null,
    v_user,
    p_project_id
  )
  returning id into v_interaction_id;

  insert into interaction_zones(interaction_id, zone_id)
  select v_interaction_id, z_id
  from unnest(p_zone_ids) as z_id;

  if array_length(v_effective_tag_ids, 1) is not null then
    insert into interaction_tags (interaction_id, tag_id, created_by)
    select v_interaction_id, tag_id, v_user
    from unnest(v_effective_tag_ids) as t(tag_id);
  end if;

  if array_length(v_effective_contact_ids, 1) is not null then
    insert into interaction_contacts (interaction_id, contact_id)
    select v_interaction_id, contact_id
    from unnest(v_effective_contact_ids) as c(contact_id);
  end if;

  if array_length(v_effective_structure_ids, 1) is not null then
    insert into interaction_structures (interaction_id, structure_id)
    select v_interaction_id, structure_id
    from unnest(v_effective_structure_ids) as s(structure_id);
  end if;

  return v_interaction_id;
end;
$$;


ALTER FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text" DEFAULT ''::"text", "p_type" "text" DEFAULT 'note'::"text", "p_status" "text" DEFAULT NULL::"text", "p_occurred_at" timestamp with time zone DEFAULT NULL::timestamp with time zone, "p_tag_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_contact_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_structure_ids" "uuid"[] DEFAULT NULL::"uuid"[], "p_project_id" "uuid" DEFAULT NULL::"uuid", "p_incoming_email_id" "uuid" DEFAULT NULL::"uuid") RETURNS "uuid"
    LANGUAGE "plpgsql"
    AS $$
DECLARE
  v_user uuid;
  v_count int;
  v_interaction_id uuid;
  v_allowed_types constant text[] := ARRAY['note','todo','call','meeting','document','expense','message','signature','other','email','quote'];  -- Added 'email' and 'quote' types
  v_allowed_status constant text[] := ARRAY['pending','in_progress','done','archived'];
  v_effective_occurred_at timestamptz;
  v_effective_tag_ids uuid[];
  v_effective_contact_ids uuid[];
  v_effective_structure_ids uuid[];
  v_project_household uuid;
  v_email_household uuid;
BEGIN
  v_user := auth.uid();
  IF v_user IS NULL THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  IF p_subject IS NULL OR length(btrim(p_subject)) = 0 THEN
    RAISE EXCEPTION 'subject is required';
  END IF;

  IF p_zone_ids IS NULL OR array_length(p_zone_ids, 1) IS NULL THEN
    RAISE EXCEPTION 'At least one zone is required';
  END IF;

  IF NOT (p_type = ANY(v_allowed_types)) THEN
    RAISE EXCEPTION 'Invalid interaction type';
  END IF;

  IF p_status IS NOT NULL AND NOT (p_status = ANY(v_allowed_status)) THEN
    RAISE EXCEPTION 'Invalid interaction status';
  END IF;

  v_effective_occurred_at := COALESCE(p_occurred_at, now());
  v_effective_tag_ids := COALESCE(p_tag_ids, ARRAY[]::uuid[]);
  v_effective_contact_ids := COALESCE(p_contact_ids, ARRAY[]::uuid[]);
  v_effective_structure_ids := COALESCE(p_structure_ids, ARRAY[]::uuid[]);

  -- Deduplicate arrays
  IF array_length(v_effective_tag_ids, 1) IS NOT NULL THEN
    SELECT array_agg(DISTINCT tag_id)
      INTO v_effective_tag_ids
    FROM unnest(v_effective_tag_ids) AS t(tag_id);
  END IF;

  IF array_length(v_effective_contact_ids, 1) IS NOT NULL THEN
    SELECT array_agg(DISTINCT contact_id)
      INTO v_effective_contact_ids
    FROM unnest(v_effective_contact_ids) AS c(contact_id);
  END IF;

  IF array_length(v_effective_structure_ids, 1) IS NOT NULL THEN
    SELECT array_agg(DISTINCT structure_id)
      INTO v_effective_structure_ids
    FROM unnest(v_effective_structure_ids) AS s(structure_id);
  END IF;

  -- Validate user membership
  SELECT count(*) INTO v_count
  FROM household_members hm
  WHERE hm.household_id = p_household_id
    AND hm.user_id = v_user;
  IF v_count = 0 THEN
    RAISE EXCEPTION 'Not a member of household';
  END IF;

  -- Validate zones belong to household
  SELECT count(*) INTO v_count
  FROM zones z
  WHERE z.household_id = p_household_id
    AND z.id = ANY(p_zone_ids);
  IF v_count <> COALESCE(array_length(p_zone_ids, 1), 0) THEN
    RAISE EXCEPTION 'All zones must belong to the same household';
  END IF;

  -- Validate tags
  IF array_length(v_effective_tag_ids, 1) IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM tags t
    WHERE t.household_id = p_household_id
      AND t.type = 'interaction'
      AND t.id = ANY(v_effective_tag_ids);
    IF v_count <> array_length(v_effective_tag_ids, 1) THEN
      RAISE EXCEPTION 'Tags must belong to the household and be interaction tags';
    END IF;
  END IF;

  -- Validate contacts
  IF array_length(v_effective_contact_ids, 1) IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM contacts c
    WHERE c.household_id = p_household_id
      AND c.id = ANY(v_effective_contact_ids);
    IF v_count <> array_length(v_effective_contact_ids, 1) THEN
      RAISE EXCEPTION 'Contacts must belong to the household';
    END IF;
  END IF;

  -- Validate structures
  IF array_length(v_effective_structure_ids, 1) IS NOT NULL THEN
    SELECT count(*) INTO v_count
    FROM structures s
    WHERE s.household_id = p_household_id
      AND s.id = ANY(v_effective_structure_ids);
    IF v_count <> array_length(v_effective_structure_ids, 1) THEN
      RAISE EXCEPTION 'Structures must belong to the household';
    END IF;
  END IF;

  -- Validate project belongs to household
  IF p_project_id IS NOT NULL THEN
    SELECT household_id INTO v_project_household
    FROM projects
    WHERE id = p_project_id;

    IF v_project_household IS NULL THEN
      RAISE EXCEPTION 'Project does not exist';
    END IF;

    IF v_project_household <> p_household_id THEN
      RAISE EXCEPTION 'Project must belong to the household';
    END IF;
  END IF;

  -- Validate incoming email belongs to household
  IF p_incoming_email_id IS NOT NULL THEN
    SELECT household_id INTO v_email_household
    FROM incoming_emails
    WHERE id = p_incoming_email_id;

    IF v_email_household IS NULL THEN
      RAISE EXCEPTION 'Incoming email does not exist';
    END IF;

    IF v_email_household <> p_household_id THEN
      RAISE EXCEPTION 'Incoming email must belong to the household';
    END IF;
  END IF;

  -- Insert the interaction
  INSERT INTO interactions (
    household_id,
    subject,
    content,
    type,
    status,
    occurred_at,
    metadata,
    enriched_text,
    created_by,
    project_id
  )
  VALUES (
    p_household_id,
    trim(p_subject),
    COALESCE(p_content, ''),
    p_type,
    p_status,
    v_effective_occurred_at,
    CASE 
      WHEN p_incoming_email_id IS NOT NULL THEN 
        jsonb_build_object('source', 'email', 'incoming_email_id', p_incoming_email_id)
      ELSE '{}'::jsonb 
    END,
    NULL,
    v_user,
    p_project_id
  )
  RETURNING id INTO v_interaction_id;

  -- Link zones
  INSERT INTO interaction_zones(interaction_id, zone_id)
  SELECT v_interaction_id, z_id
  FROM unnest(p_zone_ids) AS z_id;

  -- Link tags
  IF array_length(v_effective_tag_ids, 1) IS NOT NULL THEN
    INSERT INTO interaction_tags (interaction_id, tag_id, created_by)
    SELECT v_interaction_id, tag_id, v_user
    FROM unnest(v_effective_tag_ids) AS t(tag_id);
  END IF;

  -- Link contacts
  IF array_length(v_effective_contact_ids, 1) IS NOT NULL THEN
    INSERT INTO interaction_contacts (interaction_id, contact_id)
    SELECT v_interaction_id, contact_id
    FROM unnest(v_effective_contact_ids) AS c(contact_id);
  END IF;

  -- Link structures
  IF array_length(v_effective_structure_ids, 1) IS NOT NULL THEN
    INSERT INTO interaction_structures (interaction_id, structure_id)
    SELECT v_interaction_id, structure_id
    FROM unnest(v_effective_structure_ids) AS s(structure_id);
  END IF;

  -- Mark the incoming email as processed if provided
  IF p_incoming_email_id IS NOT NULL THEN
    UPDATE incoming_emails 
    SET 
      processing_status = 'completed',
      interaction_id = v_interaction_id,
      processed_at = now()
    WHERE id = p_incoming_email_id;
  END IF;

  RETURN v_interaction_id;
END;
$$;


ALTER FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_incoming_email_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."delete_household"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."delete_household"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_interaction_has_zone_after_delete"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  remaining int;
  interaction_present boolean;
begin
  select exists (select 1 from interactions i where i.id = old.interaction_id) into interaction_present;
  if not interaction_present then
    return old;
  end if;

  select count(*) into remaining from interaction_zones where interaction_id = old.interaction_id;
  if remaining = 0 then
    raise exception 'Interaction must have at least one zone';
  end if;
  return old;
end;
$$;


ALTER FUNCTION "public"."enforce_interaction_has_zone_after_delete"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_interaction_has_zone_after_update"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  remaining int;
  interaction_present boolean;
begin
  if old.interaction_id is distinct from new.interaction_id then
    select exists (select 1 from interactions i where i.id = old.interaction_id) into interaction_present;
    if interaction_present then
      select count(*) into remaining from interaction_zones where interaction_id = old.interaction_id;
      if remaining = 0 then
        raise exception 'Interaction must have at least one zone';
      end if;
    end if;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."enforce_interaction_has_zone_after_update"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."enforce_project_zone_household_consistency"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if not exists (
    select 1
    from projects p
    join zones z on z.household_id = p.household_id
    where p.id = NEW.project_id
    and z.id = NEW.zone_id
  ) then
    raise exception 'Project and zone must belong to the same household';
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."enforce_project_zone_household_consistency"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_equipment_interactions_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from equipment e
    join interactions i on i.id = new.interaction_id
    where e.id = new.equipment_id
      and e.household_id = i.household_id
  ) into v_ok;

  if not v_ok then
    raise exception 'Equipment and interaction must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_equipment_interactions_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_equipment_zone_matches_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_zone_household uuid;
begin
  if new.zone_id is null then
    return new;
  end if;

  select household_id into v_zone_household
  from zones
  where id = new.zone_id;

  if v_zone_household is null then
    raise exception 'Zone does not exist';
  end if;

  if v_zone_household <> new.household_id then
    raise exception 'Zone must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_equipment_zone_matches_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_household_email_alias"() RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    household_record record;
BEGIN
    -- Update households without aliases
    FOR household_record IN 
        SELECT id FROM households WHERE inbound_email_alias IS NULL
    LOOP
        UPDATE households 
        SET inbound_email_alias = generate_household_email_alias(household_record.id)
        WHERE id = household_record.id;
    END LOOP;
END;
$$;


ALTER FUNCTION "public"."ensure_household_email_alias"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_interaction_contacts_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_valid boolean;
begin
  select exists (
    select 1
    from interactions i
    join contacts c on c.id = new.contact_id
    where i.id = new.interaction_id
      and c.household_id = i.household_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Interaction and contact must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_interaction_contacts_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_interaction_documents_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_exists boolean;
begin
  select exists (
    select 1
    from interactions i
    join documents d on d.id = new.document_id
    where i.id = new.interaction_id
      and d.household_id = i.household_id
  ) into v_exists;

  if not v_exists then
    raise exception 'Interaction and document must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_interaction_documents_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_interaction_project_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_project_household uuid;
begin
  if new.project_id is null then
    return new;
  end if;

  select household_id
    into v_project_household
  from projects
  where id = new.project_id;

  if v_project_household is null then
    raise exception 'project does not exist';
  end if;

  if v_project_household <> new.household_id then
    raise exception 'project must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_interaction_project_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_interaction_structures_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_valid boolean;
begin
  select exists (
    select 1
    from interactions i
    join structures s on s.id = new.structure_id
    where i.id = new.interaction_id
      and s.household_id = i.household_id
  ) into v_valid;

  if not v_valid then
    raise exception 'Interaction and structure must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_interaction_structures_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_project_cover_interaction_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_cover_household uuid;
begin
  if new.cover_interaction_id is null then
    return new;
  end if;

  select household_id
    into v_cover_household
  from interactions
  where id = new.cover_interaction_id;

  if v_cover_household is null then
    raise exception 'cover interaction does not exist';
  end if;

  if v_cover_household <> new.household_id then
    raise exception 'cover interaction must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_project_cover_interaction_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_project_group_matches_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_group_household uuid;
begin
  if new.project_group_id is null then
    return new;
  end if;

  select household_id
    into v_group_household
  from project_groups
  where id = new.project_group_id;

  if v_group_household is null then
    raise exception 'project group does not exist';
  end if;

  if v_group_household <> new.household_id then
    raise exception 'project group must belong to the same household';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_project_group_matches_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_single_default_household"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- If setting a household as default, unset all others for the same user(s)
    IF NEW.default_household = TRUE AND (OLD IS NULL OR OLD.default_household = FALSE) THEN
        -- Get all users who are members of this household
        -- and unset default for their other households
        UPDATE households 
        SET default_household = FALSE 
        WHERE id != NEW.id 
        AND default_household = TRUE
        AND id IN (
            SELECT DISTINCT hm1.household_id 
            FROM household_members hm1
            WHERE hm1.user_id IN (
                SELECT hm2.user_id 
                FROM household_members hm2 
                WHERE hm2.household_id = NEW.id
            )
        );
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."ensure_single_default_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."ensure_zone_documents_same_household"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_ok boolean;
begin
  select exists (
    select 1
    from zones z
    join documents d on d.id = new.document_id
    where z.id = new.zone_id
      and d.household_id = z.household_id
      and d.type = 'photo'
  ) into v_ok;

  if not v_ok then
    raise exception 'Zone and document must belong to the same household and document must be a photo';
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."ensure_zone_documents_same_household"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."equipment_set_created_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if new.created_at is null then
    new.created_at := now();
  end if;
  new.updated_at := coalesce(new.updated_at, new.created_at);

  if new.created_by is null then
    new.created_by := v_user;
  end if;
  if new.updated_by is null then
    new.updated_by := v_user;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."equipment_set_created_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."equipment_set_updated_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  new.updated_at := now();
  if v_user is not null then
    new.updated_by := v_user;
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."equipment_set_updated_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."generate_household_email_alias"("household_uuid" "uuid") RETURNS "text"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
DECLARE
    base_alias text;
    final_alias text;
    counter int := 1;
BEGIN
    -- Get first 8 characters of household id as base
    base_alias := substring(household_uuid::text from 1 for 8);
    final_alias := base_alias;
    
    -- Check for uniqueness and increment if needed
    WHILE EXISTS (SELECT 1 FROM households WHERE inbound_email_alias = final_alias) LOOP
        final_alias := base_alias || counter;
        counter := counter + 1;
    END LOOP;
    
    RETURN final_alias;
END;
$$;


ALTER FUNCTION "public"."generate_household_email_alias"("household_uuid" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_household_members"("p_household_id" "uuid") RETURNS TABLE("user_id" "uuid", "user_email" "text", "user_display_name" "text", "role" "text", "joined_at" timestamp with time zone)
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public', 'auth'
    AS $$
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


ALTER FUNCTION "public"."get_household_members"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_system_stats"() RETURNS json
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  stats json;
  calling_user uuid;
begin
  calling_user := auth.uid();
  
  -- Check if user is system admin (direct query, not using helper function)
  if not exists (
    select 1 from system_admins 
    where user_id = calling_user
  ) then
    raise exception 'Access denied. Admin privileges required.';
  end if;
  
  select json_build_object(
    'total_users', (
      select count(*) 
      from auth.users 
      where deleted_at is null
    ),
    'total_households', (select count(*) from households),
    'total_interactions', (select count(*) from interactions),
    'total_zones', (select count(*) from zones),
    'total_documents', (select count(*) from documents),
    'total_projects', (select count(*) from projects),
    'total_equipment', (select count(*) from equipment),
    'active_users_last_30_days', 0, -- Placeholder since auth.audit_log_entries might not be accessible
    'new_households_last_30_days', (
      select count(*) 
      from households 
      where created_at > now() - interval '30 days'
    ),
    'storage_usage_mb', 0 -- Placeholder since storage usage requires special access
  ) into stats;
  
  return stats;
end;
$$;


ALTER FUNCTION "public"."get_system_stats"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."get_user_admin_role"() RETURNS "text"
    LANGUAGE "sql" STABLE
    AS $$
  select coalesce(role, 'user')
  from system_admins
  where user_id = auth.uid();
$$;


ALTER FUNCTION "public"."get_user_admin_role"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."grant_admin_role"("p_user_id" "uuid", "p_role" "text" DEFAULT 'admin'::"text", "p_notes" "text" DEFAULT ''::"text") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_granter uuid;
begin
  v_granter := auth.uid();
  
  -- Check if granter is super_admin (direct query)
  if not exists (
    select 1 from system_admins 
    where user_id = v_granter and role = 'super_admin'
  ) then
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


ALTER FUNCTION "public"."grant_admin_role"("p_user_id" "uuid", "p_role" "text", "p_notes" "text") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_super_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from system_admins
    where user_id = auth.uid() and role = 'super_admin'
  );
$$;


ALTER FUNCTION "public"."is_super_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."is_system_admin"() RETURNS boolean
    LANGUAGE "sql" STABLE
    AS $$
  select exists (
    select 1 from system_admins
    where user_id = auth.uid()
  );
$$;


ALTER FUNCTION "public"."is_system_admin"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."leave_household"("p_household_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    SET "search_path" TO 'public'
    AS $$
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


ALTER FUNCTION "public"."leave_household"("p_household_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."lighten_hex_color"("base" "text", "factor" double precision DEFAULT 0.12) RETURNS "text"
    LANGUAGE "plpgsql"
    AS $$
declare
  clean text;
  bytes bytea;
  r int;
  g int;
  b int;
  pct double precision := greatest(0.0, least(coalesce(factor, 0.12), 1.0));
begin
  if base is null then
    return '#f4f4f5';
  end if;

  clean := replace(base, '#', '');
  if length(clean) != 6 then
    raise exception 'Invalid hex color %', base;
  end if;

  bytes := decode(clean, 'hex');
  r := get_byte(bytes, 0);
  g := get_byte(bytes, 1);
  b := get_byte(bytes, 2);

  r := least(255, round(r + (255 - r) * pct));
  g := least(255, round(g + (255 - g) * pct));
  b := least(255, round(b + (255 - b) * pct));

  return '#' || lpad(to_hex(r), 2, '0') || lpad(to_hex(g), 2, '0') || lpad(to_hex(b), 2, '0');
end;
$$;


ALTER FUNCTION "public"."lighten_hex_color"("base" "text", "factor" double precision) OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_expense_amount"("p_metadata" "jsonb") RETURNS numeric
    LANGUAGE "plpgsql"
    AS $_$
declare
  v_amount numeric := 0;
  v_text text;
  v_node jsonb;
begin
  if p_metadata is null then
    return 0;
  end if;

  v_node := p_metadata -> 'amount';
  if v_node is null then
    return 0;
  end if;

  if jsonb_typeof(v_node) = 'number' then
    return (v_node::text)::numeric;
  end if;

  if jsonb_typeof(v_node) = 'string' then
    v_text := btrim(v_node::text, '\"');
    v_text := btrim(v_text);
    if v_text ~ '^-?[0-9]+(\\.[0-9]+)?$' then
      v_amount := v_text::numeric;
      return v_amount;
    end if;
  end if;

  return 0;
end;
$_$;


ALTER FUNCTION "public"."project_expense_amount"("p_metadata" "jsonb") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_groups_set_created_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if new.created_at is null then
    new.created_at := now();
  end if;
  new.updated_at := coalesce(new.updated_at, new.created_at);

  if new.created_by is null then
    new.created_by := v_user;
  end if;
  if new.updated_by is null then
    new.updated_by := v_user;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."project_groups_set_created_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."project_groups_set_updated_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  new.updated_at := now();
  if v_user is not null then
    new.updated_by := v_user;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."project_groups_set_updated_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."projects_set_created_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();
  if new.created_at is null then
    new.created_at := now();
  end if;
  new.updated_at := coalesce(new.updated_at, new.created_at);

  if new.created_by is null then
    new.created_by := v_user;
  end if;
  if new.updated_by is null then
    new.updated_by := v_user;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."projects_set_created_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."projects_set_updated_fields"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_user uuid;
begin
  v_user := auth.uid();

  new.updated_at := now();
  if v_user is not null then
    new.updated_by := v_user;
  end if;

  if new.status = 'completed' and (old.status is distinct from 'completed') then
    if new.closed_at is null then
      new.closed_at := now();
    end if;
  elsif new.status <> 'completed' and old.status = 'completed' then
    -- Reopening a project clears the completion timestamp to keep semantics explicit.
    new.closed_at := null;
  end if;

  return new;
end;
$$;


ALTER FUNCTION "public"."projects_set_updated_fields"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."refresh_project_actual_cost"("p_project_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_total numeric := 0;
  v_user uuid := auth.uid();
begin
  if p_project_id is null then
    return;
  end if;

  select coalesce(sum(project_expense_amount(i.metadata)), 0)
  into v_total
  from interactions i
  where i.project_id = p_project_id
    and i.type = 'expense';

  update projects
  set actual_cost_cached = v_total,
      updated_at = now(),
      updated_by = coalesce(v_user, updated_by)
  where id = p_project_id;
end;
$$;


ALTER FUNCTION "public"."refresh_project_actual_cost"("p_project_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."revoke_admin_role"("p_user_id" "uuid") RETURNS "void"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
declare
  v_revoker uuid;
begin
  v_revoker := auth.uid();
  
  -- Check if revoker is super_admin (direct query)
  if not exists (
    select 1 from system_admins 
    where user_id = v_revoker and role = 'super_admin'
  ) then
    raise exception 'Only super admins can revoke admin roles';
  end if;
  
  -- Cannot revoke own admin role
  if p_user_id = v_revoker then
    raise exception 'Cannot revoke your own admin role';
  end if;
  
  delete from system_admins where user_id = p_user_id;
end;
$$;


ALTER FUNCTION "public"."revoke_admin_role"("p_user_id" "uuid") OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_default_household_if_first"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    -- Check if this is the user's first household membership
    IF NOT EXISTS (
        SELECT 1 FROM household_members hm
        WHERE hm.user_id = NEW.user_id 
        AND hm.household_id != NEW.household_id
    ) THEN
        -- This is the first household for this user, make it default
        UPDATE households 
        SET default_household = TRUE 
        WHERE id = NEW.household_id;
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_default_household_if_first"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_document_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_document_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_equipment_interactions_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_equipment_interactions_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_interaction_tag_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_interaction_tag_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_project_zones_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if NEW.created_by is null then
    NEW.created_by := auth.uid();
  end if;
  return NEW;
end;
$$;


ALTER FUNCTION "public"."set_project_zones_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_tag_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_tag_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_zone_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by = auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_zone_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_zone_documents_created_by"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  if new.created_by is null then
    new.created_by := auth.uid();
  end if;
  return new;
end;
$$;


ALTER FUNCTION "public"."set_zone_documents_created_by"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_interactions_assert_quote_links"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  perform assert_quote_has_link(new.id);
  return new;
end;
$$;


ALTER FUNCTION "public"."trg_interactions_assert_quote_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_join_tables_assert_quote_links"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
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


ALTER FUNCTION "public"."trg_join_tables_assert_quote_links"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."trg_refresh_project_actual_cost"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
declare
  v_old_changed boolean := false;
  v_new_changed boolean := false;
begin
  if tg_op = 'INSERT' then
    if new.project_id is not null and new.type = 'expense' then
      perform refresh_project_actual_cost(new.project_id);
    end if;
    return new;
  elsif tg_op = 'UPDATE' then
    v_old_changed := (
      old.project_id is not null
      and old.type = 'expense'
      and (
        new.project_id is distinct from old.project_id
        or new.type is distinct from old.type
      )
    );

    v_new_changed := (
      new.project_id is not null
      and new.type = 'expense'
      and (
        new.project_id is distinct from old.project_id
        or new.type is distinct from old.type
        or coalesce(new.metadata, '{}'::jsonb) is distinct from coalesce(old.metadata, '{}'::jsonb)
      )
    );

    if v_old_changed then
      perform refresh_project_actual_cost(old.project_id);
    end if;

    if v_new_changed then
      perform refresh_project_actual_cost(new.project_id);
    end if;

    return new;
  elsif tg_op = 'DELETE' then
    if old.project_id is not null and old.type = 'expense' then
      perform refresh_project_actual_cost(old.project_id);
    end if;
    return old;
  end if;

  return null;
end;
$$;


ALTER FUNCTION "public"."trg_refresh_project_actual_cost"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_address_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_address_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_contact_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_contact_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_email_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_email_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_incoming_email_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
BEGIN
    NEW.updated_at = now();
    NEW.updated_by = auth.uid();
    
    -- Set processed_at when status changes to completed, failed, or ignored
    IF OLD.processing_status != NEW.processing_status 
       AND NEW.processing_status IN ('completed', 'failed', 'ignored') THEN
        NEW.processed_at = now();
    END IF;
    
    RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."update_incoming_email_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_interaction_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
  new.updated_at = now();
  new.updated_by = auth.uid();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_interaction_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_phone_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_phone_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_project_ai_threads_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_project_ai_threads_updated_at"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_structure_metadata"() RETURNS "trigger"
    LANGUAGE "plpgsql" SECURITY DEFINER
    AS $$
begin
    new.updated_at = now();
    new.updated_by = auth.uid();
    return new;
end;
$$;


ALTER FUNCTION "public"."update_structure_metadata"() OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."update_system_admins_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
begin
  new.updated_at = now();
  return new;
end;
$$;


ALTER FUNCTION "public"."update_system_admins_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."addresses" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "structure_id" "uuid",
    "address_1" "text" DEFAULT ''::"text" NOT NULL,
    "address_2" "text" DEFAULT ''::"text" NOT NULL,
    "zipcode" "text" DEFAULT ''::"text" NOT NULL,
    "city" "text" DEFAULT ''::"text" NOT NULL,
    "country" "text" DEFAULT ''::"text" NOT NULL,
    "label" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "one_parent_check" CHECK (((("contact_id" IS NOT NULL) AND ("structure_id" IS NULL)) OR (("contact_id" IS NULL) AND ("structure_id" IS NOT NULL))))
);


ALTER TABLE "public"."addresses" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contacts" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "structure_id" "uuid",
    "first_name" "text" DEFAULT ''::"text" NOT NULL,
    "last_name" "text" DEFAULT ''::"text" NOT NULL,
    "position" "text" DEFAULT ''::"text",
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."documents" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "file_path" "text" NOT NULL,
    "mime_type" "text",
    "ocr_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "type" "text" DEFAULT 'document'::"text" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "household_id" "uuid" NOT NULL,
    CONSTRAINT "documents_type_check" CHECK (("type" = ANY (ARRAY['document'::"text", 'photo'::"text", 'quote'::"text", 'invoice'::"text", 'contract'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "structure_id" "uuid",
    "email" "text" NOT NULL,
    "label" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "one_parent_check" CHECK (((("contact_id" IS NOT NULL) AND ("structure_id" IS NULL)) OR (("contact_id" IS NULL) AND ("structure_id" IS NOT NULL))))
);


ALTER TABLE "public"."emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "zone_id" "uuid",
    "name" "text" NOT NULL,
    "category" "text" DEFAULT 'general'::"text" NOT NULL,
    "manufacturer" "text",
    "model" "text",
    "serial_number" "text",
    "purchase_date" "date",
    "purchase_price" numeric(12,2),
    "purchase_vendor" "text",
    "warranty_expires_on" "date",
    "warranty_provider" "text",
    "warranty_notes" "text" DEFAULT ''::"text" NOT NULL,
    "maintenance_interval_months" integer,
    "last_service_at" "date",
    "next_service_due" "date" GENERATED ALWAYS AS (
CASE
    WHEN (("maintenance_interval_months" IS NOT NULL) AND ("last_service_at" IS NOT NULL)) THEN (("last_service_at" + "make_interval"("months" => "maintenance_interval_months")))::"date"
    ELSE NULL::"date"
END) STORED,
    "status" "text" DEFAULT 'active'::"text" NOT NULL,
    "condition" "text" DEFAULT 'good'::"text",
    "installed_at" "date",
    "retired_at" "date",
    "notes" "text" DEFAULT ''::"text" NOT NULL,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    CONSTRAINT "equipment_status_check" CHECK (("status" = ANY (ARRAY['active'::"text", 'maintenance'::"text", 'storage'::"text", 'retired'::"text", 'lost'::"text", 'ordered'::"text"])))
);


ALTER TABLE "public"."equipment" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."equipment_interactions" (
    "equipment_id" "uuid" NOT NULL,
    "interaction_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'log'::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."equipment_interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."household_members" (
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'member'::"text"
);


ALTER TABLE "public"."household_members" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."households" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "address" "text" DEFAULT ''::"text",
    "city" "text" DEFAULT ''::"text",
    "country" "text" DEFAULT ''::"text",
    "context_notes" "text" DEFAULT ''::"text",
    "ai_prompt_context" "text" DEFAULT ''::"text",
    "inbound_email_alias" "text",
    "default_household" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."households" OWNER TO "postgres";


COMMENT ON COLUMN "public"."households"."address" IS 'Physical address of the household for location context';



COMMENT ON COLUMN "public"."households"."city" IS 'City where the household is located';



COMMENT ON COLUMN "public"."households"."country" IS 'Country where the household is located';



COMMENT ON COLUMN "public"."households"."context_notes" IS 'General notes and context about the household';



COMMENT ON COLUMN "public"."households"."ai_prompt_context" IS 'Specific context information to include in AI prompts for better responses';



COMMENT ON COLUMN "public"."households"."default_household" IS 'Indicates if this household is the default for email processing. Only one household per user can be default.';



CREATE TABLE IF NOT EXISTS "public"."incoming_email_attachments" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "incoming_email_id" "uuid" NOT NULL,
    "filename" "text" NOT NULL,
    "content_type" "text",
    "size_bytes" bigint,
    "content_base64" "text",
    "document_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."incoming_email_attachments" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."incoming_emails" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "message_id" "text" NOT NULL,
    "from_email" "text" NOT NULL,
    "from_name" "text" DEFAULT ''::"text",
    "to_email" "text" NOT NULL,
    "subject" "text" DEFAULT ''::"text" NOT NULL,
    "body_text" "text" DEFAULT ''::"text",
    "body_html" "text" DEFAULT ''::"text",
    "processing_status" "public"."email_processing_status" DEFAULT 'pending'::"public"."email_processing_status" NOT NULL,
    "processing_error" "text",
    "interaction_id" "uuid",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "received_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."incoming_emails" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interaction_contacts" (
    "interaction_id" "uuid" NOT NULL,
    "contact_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interaction_contacts" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interaction_documents" (
    "interaction_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'attachment'::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interaction_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interaction_structures" (
    "interaction_id" "uuid" NOT NULL,
    "structure_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."interaction_structures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interaction_tags" (
    "interaction_id" "uuid" NOT NULL,
    "tag_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."interaction_tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interaction_zones" (
    "interaction_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL
);


ALTER TABLE "public"."interaction_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."interactions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "content" "text" DEFAULT ''::"text" NOT NULL,
    "enriched_text" "text",
    "metadata" "jsonb" DEFAULT '{}'::"jsonb",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    "subject" "text" DEFAULT 'Untitled interaction'::"text" NOT NULL,
    "type" "text" DEFAULT 'note'::"text" NOT NULL,
    "status" "text",
    "occurred_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "project_id" "uuid",
    CONSTRAINT "interactions_status_check" CHECK ((("status" IS NULL) OR ("status" = ANY (ARRAY['pending'::"text", 'in_progress'::"text", 'done'::"text", 'archived'::"text"])))),
    CONSTRAINT "interactions_type_check" CHECK (("type" = ANY (ARRAY['note'::"text", 'todo'::"text", 'call'::"text", 'meeting'::"text", 'document'::"text", 'expense'::"text", 'message'::"text", 'signature'::"text", 'other'::"text", 'quote'::"text", 'visit'::"text", 'visite'::"text", 'maintenance'::"text", 'repair'::"text", 'installation'::"text", 'inspection'::"text", 'warranty'::"text", 'issue'::"text", 'upgrade'::"text", 'replacement'::"text", 'disposal'::"text"])))
);


ALTER TABLE "public"."interactions" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."phones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "contact_id" "uuid",
    "structure_id" "uuid",
    "phone" "text" NOT NULL,
    "label" "text" DEFAULT ''::"text",
    "is_primary" boolean DEFAULT false,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid",
    CONSTRAINT "one_parent_check" CHECK (((("contact_id" IS NOT NULL) AND ("structure_id" IS NULL)) OR (("contact_id" IS NULL) AND ("structure_id" IS NOT NULL))))
);


ALTER TABLE "public"."phones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_ai_messages" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "thread_id" "uuid" NOT NULL,
    "role" "text" NOT NULL,
    "content" "text" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "project_ai_messages_role_check" CHECK (("role" = ANY (ARRAY['user'::"text", 'assistant'::"text", 'system'::"text"])))
);


ALTER TABLE "public"."project_ai_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_ai_threads" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "project_id" "uuid" NOT NULL,
    "household_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "archived_at" timestamp with time zone
);


ALTER TABLE "public"."project_ai_threads" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_groups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid"
);


ALTER TABLE "public"."project_groups" OWNER TO "postgres";


CREATE OR REPLACE VIEW "public"."project_metrics" AS
SELECT
    NULL::"uuid" AS "project_id",
    NULL::bigint AS "open_todos",
    NULL::bigint AS "done_todos",
    NULL::bigint AS "documents_count",
    NULL::numeric(12,2) AS "actual_cost";


ALTER VIEW "public"."project_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."projects" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "title" "text" NOT NULL,
    "description" "text" DEFAULT ''::"text",
    "status" "public"."project_status" DEFAULT 'draft'::"public"."project_status" NOT NULL,
    "priority" integer DEFAULT 3 NOT NULL,
    "start_date" "date",
    "due_date" "date",
    "closed_at" timestamp with time zone,
    "tags" "text"[] DEFAULT '{}'::"text"[] NOT NULL,
    "planned_budget" numeric(12,2) DEFAULT 0 NOT NULL,
    "actual_cost_cached" numeric(12,2) DEFAULT 0 NOT NULL,
    "cover_interaction_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid",
    "updated_by" "uuid",
    "project_group_id" "uuid",
    "type" "text" DEFAULT 'other'::"text" NOT NULL,
    "is_pinned" boolean DEFAULT false NOT NULL,
    CONSTRAINT "projects_actual_cost_non_negative" CHECK (("actual_cost_cached" >= (0)::numeric)),
    CONSTRAINT "projects_dates_consistent" CHECK ((("start_date" IS NULL) OR ("due_date" IS NULL) OR ("due_date" >= "start_date"))),
    CONSTRAINT "projects_planned_budget_non_negative" CHECK (("planned_budget" >= (0)::numeric)),
    CONSTRAINT "projects_priority_range" CHECK ((("priority" >= 1) AND ("priority" <= 5))),
    CONSTRAINT "projects_type_check" CHECK (("type" = ANY (ARRAY['renovation'::"text", 'maintenance'::"text", 'repair'::"text", 'purchase'::"text", 'relocation'::"text", 'vacation'::"text", 'leisure'::"text", 'other'::"text"])))
);


ALTER TABLE "public"."projects" OWNER TO "postgres";


COMMENT ON COLUMN "public"."projects"."is_pinned" IS 'When true the project is highlighted and surfaced in the dashboard.';



CREATE OR REPLACE VIEW "public"."project_group_metrics" AS
 SELECT "g"."id" AS "group_id",
    COALESCE("count"(DISTINCT "p"."id"), (0)::bigint) AS "projects_count",
    COALESCE("sum"("p"."planned_budget"), (0)::numeric) AS "planned_budget",
    COALESCE("sum"("p"."actual_cost_cached"), (0)::numeric) AS "actual_cost",
    COALESCE("sum"("pm"."open_todos"), (0)::numeric) AS "open_todos",
    COALESCE("sum"("pm"."done_todos"), (0)::numeric) AS "done_todos",
    COALESCE("sum"("pm"."documents_count"), (0)::numeric) AS "documents_count"
   FROM (("public"."project_groups" "g"
     LEFT JOIN "public"."projects" "p" ON (("p"."project_group_id" = "g"."id")))
     LEFT JOIN "public"."project_metrics" "pm" ON (("pm"."project_id" = "p"."id")))
  GROUP BY "g"."id";


ALTER VIEW "public"."project_group_metrics" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."project_zones" (
    "project_id" "uuid" NOT NULL,
    "zone_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid"
);


ALTER TABLE "public"."project_zones" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."structures" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "name" "text" DEFAULT ''::"text" NOT NULL,
    "type" "text" DEFAULT ''::"text",
    "description" "text" DEFAULT ''::"text",
    "website" "text" DEFAULT ''::"text",
    "tags" "text"[] DEFAULT '{}'::"text"[],
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    "created_by" "uuid" NOT NULL,
    "updated_by" "uuid"
);


ALTER TABLE "public"."structures" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."system_admins" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'admin'::"text" NOT NULL,
    "granted_by" "uuid",
    "granted_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "notes" "text" DEFAULT ''::"text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    "updated_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "system_admins_role_check" CHECK (("role" = ANY (ARRAY['admin'::"text", 'super_admin'::"text"])))
);


ALTER TABLE "public"."system_admins" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."tags" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid" NOT NULL,
    "type" "text" DEFAULT 'interaction'::"text" NOT NULL,
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."tags" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."todo_list" (
    "id" bigint NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "title" "text" NOT NULL,
    "urgent" boolean DEFAULT false NOT NULL,
    "description" "text",
    "done" boolean DEFAULT false NOT NULL,
    "done_at" timestamp with time zone,
    "owner" "uuid" NOT NULL
);


ALTER TABLE "public"."todo_list" OWNER TO "postgres";


ALTER TABLE "public"."todo_list" ALTER COLUMN "id" ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME "public"."todo_list_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);



CREATE TABLE IF NOT EXISTS "public"."zone_documents" (
    "zone_id" "uuid" NOT NULL,
    "document_id" "uuid" NOT NULL,
    "role" "text" DEFAULT 'photo'::"text" NOT NULL,
    "note" "text" DEFAULT ''::"text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "created_by" "uuid"
);


ALTER TABLE "public"."zone_documents" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."zones" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "household_id" "uuid",
    "name" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "parent_id" "uuid",
    "created_by" "uuid",
    "note" "text",
    "surface" numeric,
    "color" "text" DEFAULT '#f4f4f5'::"text" NOT NULL,
    CONSTRAINT "zones_color_hex" CHECK (("color" ~ '^#[0-9A-Fa-f]{6}$'::"text")),
    CONSTRAINT "zones_surface_check" CHECK (("surface" >= (0)::numeric))
);


ALTER TABLE "public"."zones" OWNER TO "postgres";


ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."equipment_interactions"
    ADD CONSTRAINT "equipment_interactions_pkey" PRIMARY KEY ("equipment_id", "interaction_id");



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_pkey" PRIMARY KEY ("household_id", "user_id");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_inbound_email_alias_key" UNIQUE ("inbound_email_alias");



ALTER TABLE ONLY "public"."households"
    ADD CONSTRAINT "households_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incoming_email_attachments"
    ADD CONSTRAINT "incoming_email_attachments_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_message_id_key" UNIQUE ("message_id");



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interaction_contacts"
    ADD CONSTRAINT "interaction_contacts_pkey" PRIMARY KEY ("interaction_id", "contact_id");



ALTER TABLE ONLY "public"."interaction_documents"
    ADD CONSTRAINT "interaction_documents_pkey" PRIMARY KEY ("interaction_id", "document_id");



ALTER TABLE ONLY "public"."interaction_structures"
    ADD CONSTRAINT "interaction_structures_pkey" PRIMARY KEY ("interaction_id", "structure_id");



ALTER TABLE ONLY "public"."interaction_tags"
    ADD CONSTRAINT "interaction_tags_pkey" PRIMARY KEY ("interaction_id", "tag_id");



ALTER TABLE ONLY "public"."interaction_zones"
    ADD CONSTRAINT "interaction_zones_pkey" PRIMARY KEY ("interaction_id", "zone_id");



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_ai_messages"
    ADD CONSTRAINT "project_ai_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_ai_threads"
    ADD CONSTRAINT "project_ai_threads_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_groups"
    ADD CONSTRAINT "project_groups_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."project_zones"
    ADD CONSTRAINT "project_zones_pkey" PRIMARY KEY ("project_id", "zone_id");



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_admins"
    ADD CONSTRAINT "system_admins_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."system_admins"
    ADD CONSTRAINT "system_admins_user_id_key" UNIQUE ("user_id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."todo_list"
    ADD CONSTRAINT "todo_list_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."zone_documents"
    ADD CONSTRAINT "zone_documents_pkey" PRIMARY KEY ("zone_id", "document_id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_id_household_unique" UNIQUE ("id", "household_id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_pkey" PRIMARY KEY ("id");



CREATE INDEX "documents_created_at_idx" ON "public"."documents" USING "btree" ("created_at" DESC);



CREATE INDEX "documents_household_id_idx" ON "public"."documents" USING "btree" ("household_id");



CREATE INDEX "documents_type_idx" ON "public"."documents" USING "btree" ("type");



CREATE INDEX "equipment_household_idx" ON "public"."equipment" USING "btree" ("household_id", "created_at" DESC);



CREATE INDEX "equipment_interactions_created_at_idx" ON "public"."equipment_interactions" USING "btree" ("created_at" DESC);



CREATE INDEX "equipment_interactions_interaction_idx" ON "public"."equipment_interactions" USING "btree" ("interaction_id");



CREATE INDEX "equipment_next_service_due_idx" ON "public"."equipment" USING "btree" ("next_service_due");



CREATE INDEX "equipment_status_idx" ON "public"."equipment" USING "btree" ("status");



CREATE INDEX "equipment_warranty_idx" ON "public"."equipment" USING "btree" ("warranty_expires_on");



CREATE INDEX "equipment_zone_idx" ON "public"."equipment" USING "btree" ("zone_id");



CREATE INDEX "idx_documents_metadata_upload_source" ON "public"."documents" USING "btree" ((("metadata" ->> 'uploadSource'::"text"))) WHERE (("metadata" ->> 'uploadSource'::"text") IS NOT NULL);



CREATE INDEX "idx_households_city" ON "public"."households" USING "btree" ("city") WHERE ("city" <> ''::"text");



CREATE INDEX "idx_households_country" ON "public"."households" USING "btree" ("country") WHERE ("country" <> ''::"text");



CREATE INDEX "idx_households_inbound_email_alias" ON "public"."households" USING "btree" ("inbound_email_alias") WHERE ("inbound_email_alias" IS NOT NULL);



CREATE INDEX "idx_project_ai_messages_created_at" ON "public"."project_ai_messages" USING "btree" ("created_at");



CREATE INDEX "idx_project_ai_messages_thread_id" ON "public"."project_ai_messages" USING "btree" ("thread_id");



CREATE INDEX "idx_project_ai_threads_created_at" ON "public"."project_ai_threads" USING "btree" ("created_at" DESC);



CREATE INDEX "idx_project_ai_threads_household_id" ON "public"."project_ai_threads" USING "btree" ("household_id");



CREATE INDEX "idx_project_ai_threads_project_id" ON "public"."project_ai_threads" USING "btree" ("project_id");



CREATE INDEX "idx_project_ai_threads_user_id" ON "public"."project_ai_threads" USING "btree" ("user_id");



CREATE INDEX "idx_zones_parent_id" ON "public"."zones" USING "btree" ("parent_id");



CREATE INDEX "interaction_contacts_contact_id_idx" ON "public"."interaction_contacts" USING "btree" ("contact_id");



CREATE INDEX "interaction_contacts_created_at_idx" ON "public"."interaction_contacts" USING "btree" ("created_at" DESC);



CREATE INDEX "interaction_documents_created_at_idx" ON "public"."interaction_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "interaction_documents_document_id_idx" ON "public"."interaction_documents" USING "btree" ("document_id");



CREATE INDEX "interaction_structures_created_at_idx" ON "public"."interaction_structures" USING "btree" ("created_at" DESC);



CREATE INDEX "interaction_structures_structure_id_idx" ON "public"."interaction_structures" USING "btree" ("structure_id");



CREATE INDEX "interactions_household_id_idx" ON "public"."interactions" USING "btree" ("household_id");



CREATE INDEX "interactions_household_project_occurred_idx" ON "public"."interactions" USING "btree" ("household_id", "project_id", "occurred_at" DESC);



CREATE INDEX "interactions_occurred_at_idx" ON "public"."interactions" USING "btree" ("occurred_at" DESC);



CREATE INDEX "interactions_status_idx" ON "public"."interactions" USING "btree" ("status");



CREATE INDEX "interactions_type_idx" ON "public"."interactions" USING "btree" ("type");



CREATE INDEX "project_groups_household_idx" ON "public"."project_groups" USING "btree" ("household_id", "created_at" DESC);



CREATE INDEX "project_groups_name_search_idx" ON "public"."project_groups" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((COALESCE("name", ''::"text") || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE INDEX "projects_created_at_idx" ON "public"."projects" USING "btree" ("created_at" DESC);



CREATE INDEX "projects_group_idx" ON "public"."projects" USING "btree" ("project_group_id");



CREATE INDEX "projects_household_due_date_idx" ON "public"."projects" USING "btree" ("household_id", "due_date");



CREATE INDEX "projects_household_start_date_idx" ON "public"."projects" USING "btree" ("household_id", "start_date");



CREATE INDEX "projects_household_status_idx" ON "public"."projects" USING "btree" ("household_id", "status");



CREATE INDEX "projects_text_search_idx" ON "public"."projects" USING "gin" ("to_tsvector"('"simple"'::"regconfig", ((COALESCE("title", ''::"text") || ' '::"text") || COALESCE("description", ''::"text"))));



CREATE UNIQUE INDEX "tags_unique_household_type_name_idx" ON "public"."tags" USING "btree" ("household_id", "type", "lower"("name"));



CREATE INDEX "zone_documents_created_at_idx" ON "public"."zone_documents" USING "btree" ("created_at" DESC);



CREATE INDEX "zone_documents_document_id_idx" ON "public"."zone_documents" USING "btree" ("document_id");



CREATE OR REPLACE VIEW "public"."project_metrics" AS
 SELECT "p"."id" AS "project_id",
    COALESCE("sum"(
        CASE
            WHEN (("i"."type" = 'todo'::"text") AND (COALESCE("i"."status", 'pending'::"text") <> ALL (ARRAY['done'::"text", 'archived'::"text"]))) THEN 1
            ELSE 0
        END), (0)::bigint) AS "open_todos",
    COALESCE("sum"(
        CASE
            WHEN (("i"."type" = 'todo'::"text") AND (COALESCE("i"."status", 'pending'::"text") = ANY (ARRAY['done'::"text", 'archived'::"text"]))) THEN 1
            ELSE 0
        END), (0)::bigint) AS "done_todos",
    COALESCE("count"(DISTINCT "d"."id"), (0)::bigint) AS "documents_count",
    "p"."actual_cost_cached" AS "actual_cost"
   FROM ((("public"."projects" "p"
     LEFT JOIN "public"."interactions" "i" ON (("i"."project_id" = "p"."id")))
     LEFT JOIN "public"."interaction_documents" "idoc" ON (("idoc"."interaction_id" = "i"."id")))
     LEFT JOIN "public"."documents" "d" ON (("d"."id" = "idoc"."document_id")))
  GROUP BY "p"."id";



CREATE CONSTRAINT TRIGGER "interaction_contacts_assert_quote_links" AFTER DELETE ON "public"."interaction_contacts" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."trg_join_tables_assert_quote_links"();



CREATE CONSTRAINT TRIGGER "interaction_structures_assert_quote_links" AFTER DELETE ON "public"."interaction_structures" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."trg_join_tables_assert_quote_links"();



CREATE CONSTRAINT TRIGGER "interactions_assert_quote_links" AFTER INSERT OR UPDATE ON "public"."interactions" DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION "public"."trg_interactions_assert_quote_links"();



CREATE OR REPLACE TRIGGER "set_address_metadata" BEFORE UPDATE ON "public"."addresses" FOR EACH ROW EXECUTE FUNCTION "public"."update_address_metadata"();



CREATE OR REPLACE TRIGGER "set_contact_metadata" BEFORE UPDATE ON "public"."contacts" FOR EACH ROW EXECUTE FUNCTION "public"."update_contact_metadata"();



CREATE OR REPLACE TRIGGER "set_email_metadata" BEFORE UPDATE ON "public"."emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_email_metadata"();



CREATE OR REPLACE TRIGGER "set_interaction_metadata" BEFORE UPDATE ON "public"."interactions" FOR EACH ROW EXECUTE FUNCTION "public"."update_interaction_metadata"();



CREATE OR REPLACE TRIGGER "set_phone_metadata" BEFORE UPDATE ON "public"."phones" FOR EACH ROW EXECUTE FUNCTION "public"."update_phone_metadata"();



CREATE OR REPLACE TRIGGER "set_structure_metadata" BEFORE UPDATE ON "public"."structures" FOR EACH ROW EXECUTE FUNCTION "public"."update_structure_metadata"();



CREATE OR REPLACE TRIGGER "trg_documents_set_created_by" BEFORE INSERT ON "public"."documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_document_created_by"();



CREATE OR REPLACE TRIGGER "trg_enforce_interaction_has_zone_after_delete" AFTER DELETE ON "public"."interaction_zones" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_interaction_has_zone_after_delete"();



CREATE OR REPLACE TRIGGER "trg_enforce_interaction_has_zone_after_update" AFTER UPDATE ON "public"."interaction_zones" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_interaction_has_zone_after_update"();



CREATE OR REPLACE TRIGGER "trg_ensure_single_default_household" AFTER UPDATE ON "public"."households" FOR EACH ROW WHEN (("new"."default_household" IS DISTINCT FROM "old"."default_household")) EXECUTE FUNCTION "public"."ensure_single_default_household"();



CREATE OR REPLACE TRIGGER "trg_equipment_interactions_household" BEFORE INSERT OR UPDATE ON "public"."equipment_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_equipment_interactions_same_household"();



CREATE OR REPLACE TRIGGER "trg_equipment_interactions_set_created_by" BEFORE INSERT ON "public"."equipment_interactions" FOR EACH ROW EXECUTE FUNCTION "public"."set_equipment_interactions_created_by"();



CREATE OR REPLACE TRIGGER "trg_equipment_set_created" BEFORE INSERT ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."equipment_set_created_fields"();



CREATE OR REPLACE TRIGGER "trg_equipment_set_updated" BEFORE UPDATE ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."equipment_set_updated_fields"();



CREATE OR REPLACE TRIGGER "trg_equipment_zone_consistency" BEFORE INSERT OR UPDATE ON "public"."equipment" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_equipment_zone_matches_household"();



CREATE OR REPLACE TRIGGER "trg_interaction_contacts_household" BEFORE INSERT OR UPDATE ON "public"."interaction_contacts" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_interaction_contacts_same_household"();



CREATE OR REPLACE TRIGGER "trg_interaction_documents_household" BEFORE INSERT OR UPDATE ON "public"."interaction_documents" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_interaction_documents_same_household"();



CREATE OR REPLACE TRIGGER "trg_interaction_structures_household" BEFORE INSERT OR UPDATE ON "public"."interaction_structures" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_interaction_structures_same_household"();



CREATE OR REPLACE TRIGGER "trg_interaction_tags_set_created_by" BEFORE INSERT ON "public"."interaction_tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_interaction_tag_created_by"();



CREATE OR REPLACE TRIGGER "trg_interactions_project_consistency" BEFORE INSERT OR UPDATE ON "public"."interactions" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_interaction_project_same_household"();



CREATE OR REPLACE TRIGGER "trg_interactions_refresh_project_cost" AFTER INSERT OR DELETE OR UPDATE ON "public"."interactions" FOR EACH ROW EXECUTE FUNCTION "public"."trg_refresh_project_actual_cost"();



CREATE OR REPLACE TRIGGER "trg_project_groups_set_created" BEFORE INSERT ON "public"."project_groups" FOR EACH ROW EXECUTE FUNCTION "public"."project_groups_set_created_fields"();



CREATE OR REPLACE TRIGGER "trg_project_groups_set_updated" BEFORE UPDATE ON "public"."project_groups" FOR EACH ROW EXECUTE FUNCTION "public"."project_groups_set_updated_fields"();



CREATE OR REPLACE TRIGGER "trg_project_zones_household_consistency" BEFORE INSERT OR UPDATE ON "public"."project_zones" FOR EACH ROW EXECUTE FUNCTION "public"."enforce_project_zone_household_consistency"();



CREATE OR REPLACE TRIGGER "trg_project_zones_set_created_by" BEFORE INSERT ON "public"."project_zones" FOR EACH ROW EXECUTE FUNCTION "public"."set_project_zones_created_by"();



CREATE OR REPLACE TRIGGER "trg_projects_cover_consistency" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_project_cover_interaction_same_household"();



CREATE OR REPLACE TRIGGER "trg_projects_group_consistency" BEFORE INSERT OR UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_project_group_matches_household"();



CREATE OR REPLACE TRIGGER "trg_projects_set_created" BEFORE INSERT ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."projects_set_created_fields"();



CREATE OR REPLACE TRIGGER "trg_projects_set_updated" BEFORE UPDATE ON "public"."projects" FOR EACH ROW EXECUTE FUNCTION "public"."projects_set_updated_fields"();



CREATE OR REPLACE TRIGGER "trg_set_default_household_if_first" AFTER INSERT ON "public"."household_members" FOR EACH ROW EXECUTE FUNCTION "public"."set_default_household_if_first"();



CREATE OR REPLACE TRIGGER "trg_system_admins_updated_at" BEFORE UPDATE ON "public"."system_admins" FOR EACH ROW EXECUTE FUNCTION "public"."update_system_admins_updated_at"();



CREATE OR REPLACE TRIGGER "trg_tags_set_created_by" BEFORE INSERT ON "public"."tags" FOR EACH ROW EXECUTE FUNCTION "public"."set_tag_created_by"();



CREATE OR REPLACE TRIGGER "trg_update_project_ai_threads_updated_at" BEFORE UPDATE ON "public"."project_ai_threads" FOR EACH ROW EXECUTE FUNCTION "public"."update_project_ai_threads_updated_at"();



CREATE OR REPLACE TRIGGER "trg_zone_documents_household" BEFORE INSERT OR UPDATE ON "public"."zone_documents" FOR EACH ROW EXECUTE FUNCTION "public"."ensure_zone_documents_same_household"();



CREATE OR REPLACE TRIGGER "trg_zone_documents_set_created_by" BEFORE INSERT ON "public"."zone_documents" FOR EACH ROW EXECUTE FUNCTION "public"."set_zone_documents_created_by"();



CREATE OR REPLACE TRIGGER "trg_zones_set_created_by" BEFORE INSERT ON "public"."zones" FOR EACH ROW EXECUTE FUNCTION "public"."set_zone_created_by"();



CREATE OR REPLACE TRIGGER "trigger_auto_generate_household_email_alias" BEFORE INSERT ON "public"."households" FOR EACH ROW EXECUTE FUNCTION "public"."auto_generate_household_email_alias"();



CREATE OR REPLACE TRIGGER "trigger_update_incoming_email_metadata" BEFORE UPDATE ON "public"."incoming_emails" FOR EACH ROW EXECUTE FUNCTION "public"."update_incoming_email_metadata"();



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."addresses"
    ADD CONSTRAINT "addresses_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."contacts"
    ADD CONSTRAINT "contacts_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "documents_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."emails"
    ADD CONSTRAINT "emails_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "entries_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "entries_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "entries_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."documents"
    ADD CONSTRAINT "entry_files_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interaction_zones"
    ADD CONSTRAINT "entry_zones_entry_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_zones"
    ADD CONSTRAINT "entry_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment_interactions"
    ADD CONSTRAINT "equipment_interactions_equipment_id_fkey" FOREIGN KEY ("equipment_id") REFERENCES "public"."equipment"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment_interactions"
    ADD CONSTRAINT "equipment_interactions_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."equipment"
    ADD CONSTRAINT "equipment_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."household_members"
    ADD CONSTRAINT "household_members_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incoming_email_attachments"
    ADD CONSTRAINT "incoming_email_attachments_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incoming_email_attachments"
    ADD CONSTRAINT "incoming_email_attachments_incoming_email_id_fkey" FOREIGN KEY ("incoming_email_id") REFERENCES "public"."incoming_emails"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."incoming_emails"
    ADD CONSTRAINT "incoming_emails_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interaction_contacts"
    ADD CONSTRAINT "interaction_contacts_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_contacts"
    ADD CONSTRAINT "interaction_contacts_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_documents"
    ADD CONSTRAINT "interaction_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_documents"
    ADD CONSTRAINT "interaction_documents_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_structures"
    ADD CONSTRAINT "interaction_structures_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_structures"
    ADD CONSTRAINT "interaction_structures_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_tags"
    ADD CONSTRAINT "interaction_tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."interaction_tags"
    ADD CONSTRAINT "interaction_tags_interaction_id_fkey" FOREIGN KEY ("interaction_id") REFERENCES "public"."interactions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interaction_tags"
    ADD CONSTRAINT "interaction_tags_tag_id_fkey" FOREIGN KEY ("tag_id") REFERENCES "public"."tags"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_contact_id_fkey" FOREIGN KEY ("contact_id") REFERENCES "public"."contacts"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_structure_id_fkey" FOREIGN KEY ("structure_id") REFERENCES "public"."structures"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."phones"
    ADD CONSTRAINT "phones_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_ai_messages"
    ADD CONSTRAINT "project_ai_messages_thread_id_fkey" FOREIGN KEY ("thread_id") REFERENCES "public"."project_ai_threads"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_ai_threads"
    ADD CONSTRAINT "project_ai_threads_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_ai_threads"
    ADD CONSTRAINT "project_ai_threads_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_ai_threads"
    ADD CONSTRAINT "project_ai_threads_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_groups"
    ADD CONSTRAINT "project_groups_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_zones"
    ADD CONSTRAINT "project_zones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."project_zones"
    ADD CONSTRAINT "project_zones_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "public"."projects"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."project_zones"
    ADD CONSTRAINT "project_zones_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_cover_interaction_id_fkey" FOREIGN KEY ("cover_interaction_id") REFERENCES "public"."interactions"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."projects"
    ADD CONSTRAINT "projects_project_group_id_fkey" FOREIGN KEY ("project_group_id") REFERENCES "public"."project_groups"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."structures"
    ADD CONSTRAINT "structures_updated_by_fkey" FOREIGN KEY ("updated_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_admins"
    ADD CONSTRAINT "system_admins_granted_by_fkey" FOREIGN KEY ("granted_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."system_admins"
    ADD CONSTRAINT "system_admins_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."tags"
    ADD CONSTRAINT "tags_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."todo_list"
    ADD CONSTRAINT "todo_list_owner_fkey" FOREIGN KEY ("owner") REFERENCES "auth"."users"("id") ON UPDATE CASCADE ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_documents"
    ADD CONSTRAINT "zone_documents_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "public"."documents"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zone_documents"
    ADD CONSTRAINT "zone_documents_zone_id_fkey" FOREIGN KEY ("zone_id") REFERENCES "public"."zones"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_created_by_fkey" FOREIGN KEY ("created_by") REFERENCES "auth"."users"("id");



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_household_id_fkey" FOREIGN KEY ("household_id") REFERENCES "public"."households"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."zones"
    ADD CONSTRAINT "zones_parent_same_household_fk" FOREIGN KEY ("parent_id") REFERENCES "public"."zones"("id") ON DELETE SET NULL;



CREATE POLICY "Admins read policy" ON "public"."system_admins" FOR SELECT USING ((("user_id" = "auth"."uid"()) OR (EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text"))))));



CREATE POLICY "Members can delete addresses of their household" ON "public"."addresses" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "addresses"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete attachments via household membership" ON "public"."incoming_email_attachments" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."incoming_emails" "ie"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "ie"."household_id")))
  WHERE (("ie"."id" = "incoming_email_attachments"."incoming_email_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete contacts of their household" ON "public"."contacts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "contacts"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete documents of their household" ON "public"."documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "documents"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete emails of their household" ON "public"."emails" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete equipment in their household" ON "public"."equipment" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "equipment"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete equipment_interactions in their household" ON "public"."equipment_interactions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."equipment" "e"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "e"."household_id")))
  WHERE (("e"."id" = "equipment_interactions"."equipment_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete incoming emails of their household" ON "public"."incoming_emails" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "incoming_emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete interaction tag links in their household" ON "public"."interaction_tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
     JOIN "public"."tags" "t" ON (("t"."id" = "interaction_tags"."tag_id")))
  WHERE (("i"."id" = "interaction_tags"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."household_id" = "i"."household_id") AND ("t"."type" = 'interaction'::"text")))));



CREATE POLICY "Members can delete interaction_contacts of their household" ON "public"."interaction_contacts" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_contacts"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete interaction_documents of their household" ON "public"."interaction_documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_documents"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete interaction_structures of their household" ON "public"."interaction_structures" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_structures"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete interactions of their household" ON "public"."interactions" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "interactions"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete phones of their household" ON "public"."phones" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "phones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete project groups in their household" ON "public"."project_groups" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_groups"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete project_zones of their household" ON "public"."project_zones" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "p"."household_id")))
  WHERE (("p"."id" = "project_zones"."project_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete projects in their household" ON "public"."projects" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "projects"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete structures of their household" ON "public"."structures" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "structures"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete tags of their household" ON "public"."tags" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "tags"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can delete zone_documents of their household" ON "public"."zone_documents" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."zones" "z"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "z"."household_id")))
  WHERE (("z"."id" = "zone_documents"."zone_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert addresses into their household" ON "public"."addresses" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "addresses"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert contacts into their household" ON "public"."contacts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "contacts"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert documents in their household" ON "public"."documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "documents"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert emails into their household" ON "public"."emails" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert equipment in their household" ON "public"."equipment" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "equipment"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert equipment_interactions in their household" ON "public"."equipment_interactions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."equipment" "e"
     JOIN "public"."interactions" "i" ON (("i"."id" = "equipment_interactions"."interaction_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "e"."household_id")))
  WHERE (("e"."id" = "equipment_interactions"."equipment_id") AND ("i"."household_id" = "e"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert interaction tag links in their household" ON "public"."interaction_tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
     JOIN "public"."tags" "t" ON (("t"."id" = "interaction_tags"."tag_id")))
  WHERE (("i"."id" = "interaction_tags"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."household_id" = "i"."household_id") AND ("t"."type" = 'interaction'::"text")))));



CREATE POLICY "Members can insert interaction_contacts in their household" ON "public"."interaction_contacts" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."contacts" "c" ON (("c"."id" = "interaction_contacts"."contact_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_contacts"."interaction_id") AND ("c"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert interaction_documents in their household" ON "public"."interaction_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
     JOIN "public"."documents" "d" ON (("d"."id" = "interaction_documents"."document_id")))
  WHERE (("i"."id" = "interaction_documents"."interaction_id") AND ("d"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert interaction_structures in their household" ON "public"."interaction_structures" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."structures" "s" ON (("s"."id" = "interaction_structures"."structure_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_structures"."interaction_id") AND ("s"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert interactions into their household" ON "public"."interactions" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "interactions"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert phones into their household" ON "public"."phones" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "phones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert project groups in their household" ON "public"."project_groups" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_groups"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert project_zones of their household" ON "public"."project_zones" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "p"."household_id")))
  WHERE (("p"."id" = "project_zones"."project_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert projects in their household" ON "public"."projects" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "projects"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert structures into their household" ON "public"."structures" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "structures"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert tags into their household" ON "public"."tags" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "tags"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can insert zone_documents in their household" ON "public"."zone_documents" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."zones" "z"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "z"."household_id")))
     JOIN "public"."documents" "d" ON (("d"."id" = "zone_documents"."document_id")))
  WHERE (("z"."id" = "zone_documents"."zone_id") AND ("d"."household_id" = "z"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can manage interaction_zones of their household" ON "public"."interaction_zones" USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_zones"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_zones"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read addresses of their household" ON "public"."addresses" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "addresses"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read attachments via household membership" ON "public"."incoming_email_attachments" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."incoming_emails" "ie"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "ie"."household_id")))
  WHERE (("ie"."id" = "incoming_email_attachments"."incoming_email_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read contacts of their household" ON "public"."contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "contacts"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read emails of their household" ON "public"."emails" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read incoming emails of their household" ON "public"."incoming_emails" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "incoming_emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read interaction tag links in their household" ON "public"."interaction_tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_tags"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read interactions of their household" ON "public"."interactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "interactions"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read phones of their household" ON "public"."phones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "phones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read structures of their household" ON "public"."structures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "structures"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can read tags of their household" ON "public"."tags" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "tags"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select documents of their household" ON "public"."documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "documents"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select equipment in their household" ON "public"."equipment" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "equipment"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select equipment_interactions in their household" ON "public"."equipment_interactions" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."equipment" "e"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "e"."household_id")))
  WHERE (("e"."id" = "equipment_interactions"."equipment_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select interaction_contacts of their household" ON "public"."interaction_contacts" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_contacts"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select interaction_documents of their household" ON "public"."interaction_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_documents"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select interaction_structures of their household" ON "public"."interaction_structures" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_structures"."interaction_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select project groups in their household" ON "public"."project_groups" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_groups"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select projects in their household" ON "public"."projects" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "projects"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can select zone_documents of their household" ON "public"."zone_documents" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."zones" "z"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "z"."household_id")))
  WHERE (("z"."id" = "zone_documents"."zone_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update addresses of their household" ON "public"."addresses" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "addresses"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update attachments via household membership" ON "public"."incoming_email_attachments" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."incoming_emails" "ie"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "ie"."household_id")))
  WHERE (("ie"."id" = "incoming_email_attachments"."incoming_email_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update contacts of their household" ON "public"."contacts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "contacts"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update documents of their household" ON "public"."documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "documents"."household_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "documents"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update emails of their household" ON "public"."emails" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update entries with check" ON "public"."interactions" FOR UPDATE WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "interactions"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update equipment in their household" ON "public"."equipment" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "equipment"."household_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "equipment"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update equipment_interactions in their household" ON "public"."equipment_interactions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."equipment" "e"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "e"."household_id")))
  WHERE (("e"."id" = "equipment_interactions"."equipment_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."equipment" "e"
     JOIN "public"."interactions" "i" ON (("i"."id" = "equipment_interactions"."interaction_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "e"."household_id")))
  WHERE (("e"."id" = "equipment_interactions"."equipment_id") AND ("i"."household_id" = "e"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update incoming emails of their household" ON "public"."incoming_emails" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "incoming_emails"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update interaction_contacts of their household" ON "public"."interaction_contacts" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_contacts"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."contacts" "c" ON (("c"."id" = "interaction_contacts"."contact_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_contacts"."interaction_id") AND ("c"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update interaction_documents of their household" ON "public"."interaction_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_documents"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
     JOIN "public"."documents" "d" ON (("d"."id" = "interaction_documents"."document_id")))
  WHERE (("i"."id" = "interaction_documents"."interaction_id") AND ("d"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update interaction_structures of their household" ON "public"."interaction_structures" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."interactions" "i"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_structures"."interaction_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."interactions" "i"
     JOIN "public"."structures" "s" ON (("s"."id" = "interaction_structures"."structure_id")))
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "i"."household_id")))
  WHERE (("i"."id" = "interaction_structures"."interaction_id") AND ("s"."household_id" = "i"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update interactions of their household" ON "public"."interactions" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "interactions"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update phones of their household" ON "public"."phones" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "phones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update project groups in their household" ON "public"."project_groups" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_groups"."household_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_groups"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update project_zones of their household" ON "public"."project_zones" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "p"."household_id")))
  WHERE (("p"."id" = "project_zones"."project_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "p"."household_id")))
  WHERE (("p"."id" = "project_zones"."project_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update projects in their household" ON "public"."projects" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "projects"."household_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "projects"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update structures of their household" ON "public"."structures" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "structures"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update tags of their household" ON "public"."tags" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "tags"."household_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "tags"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can update zone_documents of their household" ON "public"."zone_documents" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."zones" "z"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "z"."household_id")))
  WHERE (("z"."id" = "zone_documents"."zone_id") AND ("hm"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (("public"."zones" "z"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "z"."household_id")))
     JOIN "public"."documents" "d" ON (("d"."id" = "zone_documents"."document_id")))
  WHERE (("z"."id" = "zone_documents"."zone_id") AND ("d"."household_id" = "z"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Members can view project_zones of their household" ON "public"."project_zones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."projects" "p"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "p"."household_id")))
  WHERE (("p"."id" = "project_zones"."project_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Owner can do everything" ON "public"."todo_list" TO "authenticated" USING (("authenticative"."is_user_authenticated"() AND ("owner" = "auth"."uid"())));



CREATE POLICY "Service role can insert email attachments" ON "public"."incoming_email_attachments" FOR INSERT WITH CHECK (true);



CREATE POLICY "Service role can insert incoming emails" ON "public"."incoming_emails" FOR INSERT WITH CHECK (true);



CREATE POLICY "Super admins can create system admins" ON "public"."system_admins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can update system admins" ON "public"."system_admins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins can view all system admins" ON "public"."system_admins" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins delete policy" ON "public"."system_admins" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))) AND ("user_id" <> "auth"."uid"())));



CREATE POLICY "Super admins insert policy" ON "public"."system_admins" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))));



CREATE POLICY "Super admins update policy" ON "public"."system_admins" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text"))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."system_admins" "sa"
  WHERE (("sa"."user_id" = "auth"."uid"()) AND ("sa"."role" = 'super_admin'::"text")))));



CREATE POLICY "Users can create households" ON "public"."households" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can join a household" ON "public"."household_members" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view households they belong to" ON "public"."households" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "households"."id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view their household memberships" ON "public"."household_members" FOR SELECT USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."addresses" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."equipment_interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."household_members" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."households" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incoming_email_attachments" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."incoming_emails" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interaction_contacts" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interaction_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interaction_structures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interaction_tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interaction_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."phones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_ai_messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_ai_messages_delete_policy" ON "public"."project_ai_messages" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM ("public"."project_ai_threads" "t"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "t"."household_id")))
  WHERE (("t"."id" = "project_ai_messages"."thread_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_ai_messages_insert_policy" ON "public"."project_ai_messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."project_ai_threads" "t"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "t"."household_id")))
  WHERE (("t"."id" = "project_ai_messages"."thread_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_ai_messages_select_policy" ON "public"."project_ai_messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM ("public"."project_ai_threads" "t"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "t"."household_id")))
  WHERE (("t"."id" = "project_ai_messages"."thread_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"())))));



CREATE POLICY "project_ai_messages_update_policy" ON "public"."project_ai_messages" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM ("public"."project_ai_threads" "t"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "t"."household_id")))
  WHERE (("t"."id" = "project_ai_messages"."thread_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM ("public"."project_ai_threads" "t"
     JOIN "public"."household_members" "hm" ON (("hm"."household_id" = "t"."household_id")))
  WHERE (("t"."id" = "project_ai_messages"."thread_id") AND ("hm"."user_id" = "auth"."uid"()) AND ("t"."user_id" = "auth"."uid"())))));



ALTER TABLE "public"."project_ai_threads" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "project_ai_threads_delete_policy" ON "public"."project_ai_threads" FOR DELETE USING (((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_ai_threads"."household_id") AND ("hm"."user_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "project_ai_threads_insert_policy" ON "public"."project_ai_threads" FOR INSERT WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_ai_threads"."household_id") AND ("hm"."user_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "project_ai_threads_select_policy" ON "public"."project_ai_threads" FOR SELECT USING (((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_ai_threads"."household_id") AND ("hm"."user_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"())));



CREATE POLICY "project_ai_threads_update_policy" ON "public"."project_ai_threads" FOR UPDATE USING (((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_ai_threads"."household_id") AND ("hm"."user_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"()))) WITH CHECK (((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "project_ai_threads"."household_id") AND ("hm"."user_id" = "auth"."uid"())))) AND ("user_id" = "auth"."uid"())));



ALTER TABLE "public"."project_groups" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."project_zones" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."projects" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."structures" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."system_admins" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."tags" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."todo_list" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zone_documents" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."zones" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "zones_delete_members" ON "public"."zones" FOR DELETE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "zones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "zones_insert_members" ON "public"."zones" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "zones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "zones_select_members" ON "public"."zones" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "zones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "zones_update_members" ON "public"."zones" FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "zones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));



CREATE POLICY "zones_update_members_with_check" ON "public"."zones" FOR UPDATE WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."household_members" "hm"
  WHERE (("hm"."household_id" = "zones"."household_id") AND ("hm"."user_id" = "auth"."uid"())))));





ALTER PUBLICATION "supabase_realtime" OWNER TO "postgres";


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON TYPE "public"."email_processing_status" TO "authenticated";

























































































































































GRANT ALL ON FUNCTION "public"."assert_quote_has_link"("p_interaction_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."assert_quote_has_link"("p_interaction_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."assert_quote_has_link"("p_interaction_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."auto_generate_household_email_alias"() TO "anon";
GRANT ALL ON FUNCTION "public"."auto_generate_household_email_alias"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."auto_generate_household_email_alias"() TO "service_role";



GRANT ALL ON FUNCTION "public"."create_entry_with_zones"("p_household_id" "uuid", "p_raw_text" "text", "p_zone_ids" "uuid"[]) TO "anon";
GRANT ALL ON FUNCTION "public"."create_entry_with_zones"("p_household_id" "uuid", "p_raw_text" "text", "p_zone_ids" "uuid"[]) TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_entry_with_zones"("p_household_id" "uuid", "p_raw_text" "text", "p_zone_ids" "uuid"[]) TO "service_role";



GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text", "p_address" "text", "p_city" "text", "p_country" "text", "p_context_notes" "text", "p_ai_prompt_context" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text", "p_address" "text", "p_city" "text", "p_country" "text", "p_context_notes" "text", "p_ai_prompt_context" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_household_with_owner"("p_name" "text", "p_address" "text", "p_city" "text", "p_country" "text", "p_context_notes" "text", "p_ai_prompt_context" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_incoming_email_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_incoming_email_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."create_interaction_with_zones"("p_household_id" "uuid", "p_subject" "text", "p_zone_ids" "uuid"[], "p_content" "text", "p_type" "text", "p_status" "text", "p_occurred_at" timestamp with time zone, "p_tag_ids" "uuid"[], "p_contact_ids" "uuid"[], "p_structure_ids" "uuid"[], "p_project_id" "uuid", "p_incoming_email_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."delete_household"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."delete_household"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."delete_household"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_delete"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_delete"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_delete"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_update"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_update"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_interaction_has_zone_after_update"() TO "service_role";



GRANT ALL ON FUNCTION "public"."enforce_project_zone_household_consistency"() TO "anon";
GRANT ALL ON FUNCTION "public"."enforce_project_zone_household_consistency"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."enforce_project_zone_household_consistency"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_equipment_interactions_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_equipment_interactions_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_equipment_interactions_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_equipment_zone_matches_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_equipment_zone_matches_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_equipment_zone_matches_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_household_email_alias"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_household_email_alias"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_household_email_alias"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_interaction_contacts_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_interaction_contacts_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_interaction_contacts_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_interaction_documents_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_interaction_documents_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_interaction_documents_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_interaction_project_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_interaction_project_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_interaction_project_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_interaction_structures_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_interaction_structures_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_interaction_structures_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_project_cover_interaction_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_project_cover_interaction_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_project_cover_interaction_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_project_group_matches_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_project_group_matches_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_project_group_matches_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_single_default_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_single_default_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_single_default_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."ensure_zone_documents_same_household"() TO "anon";
GRANT ALL ON FUNCTION "public"."ensure_zone_documents_same_household"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."ensure_zone_documents_same_household"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equipment_set_created_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."equipment_set_created_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."equipment_set_created_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."equipment_set_updated_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."equipment_set_updated_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."equipment_set_updated_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."generate_household_email_alias"("household_uuid" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."generate_household_email_alias"("household_uuid" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."generate_household_email_alias"("household_uuid" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_household_members"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."get_household_members"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_household_members"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_system_stats"() TO "service_role";



GRANT ALL ON FUNCTION "public"."get_user_admin_role"() TO "anon";
GRANT ALL ON FUNCTION "public"."get_user_admin_role"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."get_user_admin_role"() TO "service_role";



GRANT ALL ON FUNCTION "public"."grant_admin_role"("p_user_id" "uuid", "p_role" "text", "p_notes" "text") TO "anon";
GRANT ALL ON FUNCTION "public"."grant_admin_role"("p_user_id" "uuid", "p_role" "text", "p_notes" "text") TO "authenticated";
GRANT ALL ON FUNCTION "public"."grant_admin_role"("p_user_id" "uuid", "p_role" "text", "p_notes" "text") TO "service_role";



GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_super_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "anon";
GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."is_system_admin"() TO "service_role";



GRANT ALL ON FUNCTION "public"."leave_household"("p_household_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."leave_household"("p_household_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."leave_household"("p_household_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."lighten_hex_color"("base" "text", "factor" double precision) TO "anon";
GRANT ALL ON FUNCTION "public"."lighten_hex_color"("base" "text", "factor" double precision) TO "authenticated";
GRANT ALL ON FUNCTION "public"."lighten_hex_color"("base" "text", "factor" double precision) TO "service_role";



GRANT ALL ON FUNCTION "public"."project_expense_amount"("p_metadata" "jsonb") TO "anon";
GRANT ALL ON FUNCTION "public"."project_expense_amount"("p_metadata" "jsonb") TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_expense_amount"("p_metadata" "jsonb") TO "service_role";



GRANT ALL ON FUNCTION "public"."project_groups_set_created_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."project_groups_set_created_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_groups_set_created_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."project_groups_set_updated_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."project_groups_set_updated_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."project_groups_set_updated_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."projects_set_created_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."projects_set_created_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."projects_set_created_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."projects_set_updated_fields"() TO "anon";
GRANT ALL ON FUNCTION "public"."projects_set_updated_fields"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."projects_set_updated_fields"() TO "service_role";



GRANT ALL ON FUNCTION "public"."refresh_project_actual_cost"("p_project_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."refresh_project_actual_cost"("p_project_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."refresh_project_actual_cost"("p_project_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."revoke_admin_role"("p_user_id" "uuid") TO "anon";
GRANT ALL ON FUNCTION "public"."revoke_admin_role"("p_user_id" "uuid") TO "authenticated";
GRANT ALL ON FUNCTION "public"."revoke_admin_role"("p_user_id" "uuid") TO "service_role";



GRANT ALL ON FUNCTION "public"."set_default_household_if_first"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_default_household_if_first"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_default_household_if_first"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_document_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_document_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_document_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_equipment_interactions_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_equipment_interactions_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_equipment_interactions_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_interaction_tag_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_interaction_tag_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_interaction_tag_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_project_zones_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_project_zones_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_project_zones_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_tag_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_tag_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_tag_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_zone_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_zone_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_zone_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."set_zone_documents_created_by"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_zone_documents_created_by"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_zone_documents_created_by"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_interactions_assert_quote_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_interactions_assert_quote_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_interactions_assert_quote_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_join_tables_assert_quote_links"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_join_tables_assert_quote_links"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_join_tables_assert_quote_links"() TO "service_role";



GRANT ALL ON FUNCTION "public"."trg_refresh_project_actual_cost"() TO "anon";
GRANT ALL ON FUNCTION "public"."trg_refresh_project_actual_cost"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."trg_refresh_project_actual_cost"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_address_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_address_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_address_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_contact_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_contact_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_contact_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_email_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_email_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_email_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_incoming_email_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_incoming_email_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_incoming_email_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_interaction_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_interaction_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_interaction_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_phone_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_phone_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_phone_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_project_ai_threads_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_project_ai_threads_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_project_ai_threads_updated_at"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_structure_metadata"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_structure_metadata"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_structure_metadata"() TO "service_role";



GRANT ALL ON FUNCTION "public"."update_system_admins_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."update_system_admins_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."update_system_admins_updated_at"() TO "service_role";


















GRANT ALL ON TABLE "public"."addresses" TO "anon";
GRANT ALL ON TABLE "public"."addresses" TO "authenticated";
GRANT ALL ON TABLE "public"."addresses" TO "service_role";



GRANT ALL ON TABLE "public"."contacts" TO "anon";
GRANT ALL ON TABLE "public"."contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."contacts" TO "service_role";



GRANT ALL ON TABLE "public"."documents" TO "anon";
GRANT ALL ON TABLE "public"."documents" TO "authenticated";
GRANT ALL ON TABLE "public"."documents" TO "service_role";



GRANT ALL ON TABLE "public"."emails" TO "anon";
GRANT ALL ON TABLE "public"."emails" TO "authenticated";
GRANT ALL ON TABLE "public"."emails" TO "service_role";



GRANT ALL ON TABLE "public"."equipment" TO "anon";
GRANT ALL ON TABLE "public"."equipment" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment" TO "service_role";



GRANT ALL ON TABLE "public"."equipment_interactions" TO "anon";
GRANT ALL ON TABLE "public"."equipment_interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."equipment_interactions" TO "service_role";



GRANT ALL ON TABLE "public"."household_members" TO "anon";
GRANT ALL ON TABLE "public"."household_members" TO "authenticated";
GRANT ALL ON TABLE "public"."household_members" TO "service_role";



GRANT ALL ON TABLE "public"."households" TO "anon";
GRANT ALL ON TABLE "public"."households" TO "authenticated";
GRANT ALL ON TABLE "public"."households" TO "service_role";



GRANT ALL ON TABLE "public"."incoming_email_attachments" TO "anon";
GRANT ALL ON TABLE "public"."incoming_email_attachments" TO "authenticated";
GRANT ALL ON TABLE "public"."incoming_email_attachments" TO "service_role";



GRANT ALL ON TABLE "public"."incoming_emails" TO "anon";
GRANT ALL ON TABLE "public"."incoming_emails" TO "authenticated";
GRANT ALL ON TABLE "public"."incoming_emails" TO "service_role";



GRANT ALL ON TABLE "public"."interaction_contacts" TO "anon";
GRANT ALL ON TABLE "public"."interaction_contacts" TO "authenticated";
GRANT ALL ON TABLE "public"."interaction_contacts" TO "service_role";



GRANT ALL ON TABLE "public"."interaction_documents" TO "anon";
GRANT ALL ON TABLE "public"."interaction_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."interaction_documents" TO "service_role";



GRANT ALL ON TABLE "public"."interaction_structures" TO "anon";
GRANT ALL ON TABLE "public"."interaction_structures" TO "authenticated";
GRANT ALL ON TABLE "public"."interaction_structures" TO "service_role";



GRANT ALL ON TABLE "public"."interaction_tags" TO "anon";
GRANT ALL ON TABLE "public"."interaction_tags" TO "authenticated";
GRANT ALL ON TABLE "public"."interaction_tags" TO "service_role";



GRANT ALL ON TABLE "public"."interaction_zones" TO "anon";
GRANT ALL ON TABLE "public"."interaction_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."interaction_zones" TO "service_role";



GRANT ALL ON TABLE "public"."interactions" TO "anon";
GRANT ALL ON TABLE "public"."interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."interactions" TO "service_role";



GRANT ALL ON TABLE "public"."phones" TO "anon";
GRANT ALL ON TABLE "public"."phones" TO "authenticated";
GRANT ALL ON TABLE "public"."phones" TO "service_role";



GRANT ALL ON TABLE "public"."project_ai_messages" TO "anon";
GRANT ALL ON TABLE "public"."project_ai_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."project_ai_messages" TO "service_role";



GRANT ALL ON TABLE "public"."project_ai_threads" TO "anon";
GRANT ALL ON TABLE "public"."project_ai_threads" TO "authenticated";
GRANT ALL ON TABLE "public"."project_ai_threads" TO "service_role";



GRANT ALL ON TABLE "public"."project_groups" TO "anon";
GRANT ALL ON TABLE "public"."project_groups" TO "authenticated";
GRANT ALL ON TABLE "public"."project_groups" TO "service_role";



GRANT ALL ON TABLE "public"."project_metrics" TO "anon";
GRANT ALL ON TABLE "public"."project_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."project_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."projects" TO "anon";
GRANT ALL ON TABLE "public"."projects" TO "authenticated";
GRANT ALL ON TABLE "public"."projects" TO "service_role";



GRANT ALL ON TABLE "public"."project_group_metrics" TO "anon";
GRANT ALL ON TABLE "public"."project_group_metrics" TO "authenticated";
GRANT ALL ON TABLE "public"."project_group_metrics" TO "service_role";



GRANT ALL ON TABLE "public"."project_zones" TO "anon";
GRANT ALL ON TABLE "public"."project_zones" TO "authenticated";
GRANT ALL ON TABLE "public"."project_zones" TO "service_role";



GRANT ALL ON TABLE "public"."structures" TO "anon";
GRANT ALL ON TABLE "public"."structures" TO "authenticated";
GRANT ALL ON TABLE "public"."structures" TO "service_role";



GRANT ALL ON TABLE "public"."system_admins" TO "anon";
GRANT ALL ON TABLE "public"."system_admins" TO "authenticated";
GRANT ALL ON TABLE "public"."system_admins" TO "service_role";



GRANT ALL ON TABLE "public"."tags" TO "anon";
GRANT ALL ON TABLE "public"."tags" TO "authenticated";
GRANT ALL ON TABLE "public"."tags" TO "service_role";



GRANT ALL ON TABLE "public"."todo_list" TO "anon";
GRANT ALL ON TABLE "public"."todo_list" TO "authenticated";
GRANT ALL ON TABLE "public"."todo_list" TO "service_role";



GRANT ALL ON SEQUENCE "public"."todo_list_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."todo_list_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."todo_list_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."zone_documents" TO "anon";
GRANT ALL ON TABLE "public"."zone_documents" TO "authenticated";
GRANT ALL ON TABLE "public"."zone_documents" TO "service_role";



GRANT ALL ON TABLE "public"."zones" TO "anon";
GRANT ALL ON TABLE "public"."zones" TO "authenticated";
GRANT ALL ON TABLE "public"."zones" TO "service_role";









ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";































RESET ALL;

  create policy "Give users access to own folder 1m0cqf_0"
  on "storage"."objects"
  as permissive
  for delete
  to public
using (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));



  create policy "Give users access to own folder 1m0cqf_1"
  on "storage"."objects"
  as permissive
  for update
  to public
using (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));



  create policy "Give users access to own folder 1m0cqf_2"
  on "storage"."objects"
  as permissive
  for insert
  to public
with check (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));



  create policy "Give users access to own folder 1m0cqf_3"
  on "storage"."objects"
  as permissive
  for select
  to public
using (((bucket_id = 'files'::text) AND authenticative.is_user_authenticated() AND (name ~ (('^'::text || (auth.uid())::text) || '/'::text))));



  create policy "Users manage own avatar delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "Users manage own avatar insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text)) AND (lower(COALESCE(storage.extension(name), ''::text)) = ANY (ARRAY['png'::text, 'jpg'::text, 'jpeg'::text, 'webp'::text]))));



  create policy "Users manage own avatar update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))))
with check (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "Users view own avatar"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'avatars'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "files_household_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL) AND (EXISTS ( SELECT 1
   FROM (documents d
     JOIN household_members hm ON ((hm.household_id = d.household_id)))
  WHERE ((d.file_path = objects.name) AND (hm.user_id = auth.uid()))))));



  create policy "files_owner_delete"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "files_owner_insert"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "files_owner_select"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));



  create policy "files_owner_update"
  on "storage"."objects"
  as permissive
  for update
  to authenticated
using (((bucket_id = 'files'::text) AND (auth.uid() IS NOT NULL) AND (name ~ (('^'::text || auth.uid()) || '/'::text))));


CREATE TRIGGER enforce_bucket_name_length_trigger BEFORE INSERT OR UPDATE OF name ON storage.buckets FOR EACH ROW EXECUTE FUNCTION storage.enforce_bucket_name_length();

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


