-- Add default_household column to households table
ALTER TABLE households ADD COLUMN default_household BOOLEAN DEFAULT FALSE NOT NULL;

-- Function to ensure only one default household per user
CREATE OR REPLACE FUNCTION ensure_single_default_household()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to set default household automatically for first membership
CREATE OR REPLACE FUNCTION set_default_household_if_first()
RETURNS TRIGGER AS $$
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
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to ensure only one default household per user
CREATE TRIGGER trg_ensure_single_default_household
    AFTER UPDATE ON households
    FOR EACH ROW
    WHEN (NEW.default_household IS DISTINCT FROM OLD.default_household)
    EXECUTE FUNCTION ensure_single_default_household();

-- Trigger to automatically set default household for first membership
CREATE TRIGGER trg_set_default_household_if_first
    AFTER INSERT ON household_members
    FOR EACH ROW
    EXECUTE FUNCTION set_default_household_if_first();

-- Comment explaining the logic
COMMENT ON COLUMN households.default_household IS 'Indicates if this household is the default for email processing. Only one household per user can be default.';
