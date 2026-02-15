-- FIX: Visibility propagation triggering quote validation
-- 
-- PROBLEM: When changing visibility on project_groups, the cascade to interactions
-- triggers the quote validation which requires contacts/structures
--
-- SOLUTION: Skip quote interactions in propagation to avoid validation trigger

CREATE OR REPLACE FUNCTION propagate_project_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    IF NEW.created_by = auth.uid() THEN
      -- Skip quote type to avoid triggering quote validation
      UPDATE public.interactions
      SET is_private = NEW.is_private
      WHERE project_id = NEW.id
        AND (created_by = auth.uid() OR is_private = false)
        AND type != 'quote';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION propagate_project_visibility() IS 'Propagates is_private changes from projects to interactions (excluding quotes to avoid validation trigger)';
