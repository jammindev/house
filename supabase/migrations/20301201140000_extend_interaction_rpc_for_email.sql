-- supabase/migrations/20251201140000_extend_interaction_rpc_for_email.sql
-- Extend the create_interaction_with_zones RPC to support email ingestion

-- Drop the existing function to replace it
DROP FUNCTION IF EXISTS create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid);

-- Recreate with the new incoming_email_id parameter
CREATE OR REPLACE FUNCTION create_interaction_with_zones(
  p_household_id uuid,
  p_subject text,
  p_zone_ids uuid[],
  p_content text DEFAULT '',
  p_type text DEFAULT 'note',
  p_status text DEFAULT NULL,
  p_occurred_at timestamptz DEFAULT NULL,
  p_tag_ids uuid[] DEFAULT NULL,
  p_contact_ids uuid[] DEFAULT NULL,
  p_structure_ids uuid[] DEFAULT NULL,
  p_project_id uuid DEFAULT NULL,
  p_incoming_email_id uuid DEFAULT NULL  -- New parameter for email ingestion
)
RETURNS uuid
LANGUAGE plpgsql
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

-- Grant execute permissions
GRANT EXECUTE ON FUNCTION create_interaction_with_zones(uuid, text, uuid[], text, text, text, timestamptz, uuid[], uuid[], uuid[], uuid, uuid) TO authenticated;