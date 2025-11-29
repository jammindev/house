-- Add context and location fields to households table for enhanced AI prompts
-- This migration adds fields to store household location and context information
-- that can be used to provide more relevant AI responses.

-- Add new columns to households table
ALTER TABLE households 
ADD COLUMN IF NOT EXISTS address text DEFAULT '',
ADD COLUMN IF NOT EXISTS city text DEFAULT '',
ADD COLUMN IF NOT EXISTS country text DEFAULT '',
ADD COLUMN IF NOT EXISTS context_notes text DEFAULT '',
ADD COLUMN IF NOT EXISTS ai_prompt_context text DEFAULT '';

-- Add comments for documentation
COMMENT ON COLUMN households.address IS 'Physical address of the household for location context';
COMMENT ON COLUMN households.city IS 'City where the household is located';
COMMENT ON COLUMN households.country IS 'Country where the household is located';
COMMENT ON COLUMN households.context_notes IS 'General notes and context about the household';
COMMENT ON COLUMN households.ai_prompt_context IS 'Specific context information to include in AI prompts for better responses';

-- Update RLS policies to include new columns in select/update operations
-- No new policies needed as the new columns follow the same access pattern as existing household data

-- Create index for city-based queries if we want to add location-based features later
CREATE INDEX IF NOT EXISTS idx_households_city ON households(city) WHERE city != '';
CREATE INDEX IF NOT EXISTS idx_households_country ON households(country) WHERE country != '';

-- Update the create_household_with_owner function to support new fields
CREATE OR REPLACE FUNCTION create_household_with_owner(
    p_name text,
    p_address text DEFAULT '',
    p_city text DEFAULT '',
    p_country text DEFAULT '',
    p_context_notes text DEFAULT '',
    p_ai_prompt_context text DEFAULT ''
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION create_household_with_owner(text, text, text, text, text, text) TO authenticated;