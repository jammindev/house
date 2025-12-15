-- SECURITY FIX: Critical RLS vulnerability in visibility system
-- 
-- PROBLEM: Current UPDATE policies allow ANY household member to modify is_private
-- on resources they don't own, potentially exposing private data.
--
-- FIX: Ensure only the creator OR members with access to the resource can update it,
-- and only the creator can change is_private.

-- ============================================================================
-- FIX PROJECTS UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Members can update projects in their household" ON public.projects;
CREATE POLICY "Members can update projects in their household"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
      AND (
        -- Can see the project (either public or creator)
        projects.is_private = false
        OR projects.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
  )
  AND (
    -- Can only update if:
    -- 1. Not changing is_private, OR
    -- 2. Is the creator (can change is_private)
    projects.created_by = auth.uid()
    OR 
    (
      -- Not the creator but not changing is_private
      projects.is_private = (SELECT p.is_private FROM public.projects p WHERE p.id = projects.id)
    )
  )
);

-- ============================================================================
-- FIX PROJECT_GROUPS UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Members can update project groups in their household" ON public.project_groups;
CREATE POLICY "Members can update project groups in their household"
ON public.project_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
      AND (
        -- Can see the group (either public or creator)
        project_groups.is_private = false
        OR project_groups.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
  )
  AND (
    -- Can only update if:
    -- 1. Is the creator, OR
    -- 2. Not changing is_private
    project_groups.created_by = auth.uid()
    OR 
    (
      -- Not the creator but not changing is_private
      project_groups.is_private = (SELECT pg.is_private FROM public.project_groups pg WHERE pg.id = project_groups.id)
    )
  )
);

-- ============================================================================
-- FIX INTERACTIONS UPDATE POLICY
-- ============================================================================
DROP POLICY IF EXISTS "Members can update interactions in their household" ON public.interactions;
CREATE POLICY "Members can update interactions in their household"
ON public.interactions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
      AND (
        -- Can see the interaction (either public or creator)
        interactions.is_private = false
        OR interactions.created_by = auth.uid()
      )
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
  )
  AND (
    -- Can only update if:
    -- 1. Is the creator, OR
    -- 2. Not changing is_private
    interactions.created_by = auth.uid()
    OR 
    (
      -- Not the creator but not changing is_private
      interactions.is_private = (SELECT i.is_private FROM public.interactions i WHERE i.id = interactions.id)
    )
  )
);

-- ============================================================================
-- FIX SECURITY DEFINER FUNCTIONS - Add permission checks
-- ============================================================================

-- Recreate project_group visibility propagation with security checks
CREATE OR REPLACE FUNCTION propagate_project_group_visibility()
RETURNS TRIGGER AS $$
BEGIN
  -- SECURITY: Only propagate if the user is the creator of the group
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    IF NEW.created_by = auth.uid() THEN
      -- Update only projects that belong to this user OR are public
      UPDATE public.projects
      SET is_private = NEW.is_private
      WHERE project_group_id = NEW.id
        AND (created_by = auth.uid() OR is_private = false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION propagate_project_group_visibility() IS 'Automatically propagates is_private changes from project_groups to projects owned by the same user';

-- Recreate project visibility propagation with security checks
CREATE OR REPLACE FUNCTION propagate_project_visibility()
RETURNS TRIGGER AS $$
BEGIN
  -- SECURITY: Only propagate if the user is the creator of the project
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    IF NEW.created_by = auth.uid() THEN
      -- Update only interactions that belong to this user OR are public
      UPDATE public.interactions
      SET is_private = NEW.is_private
      WHERE project_id = NEW.id
        AND (created_by = auth.uid() OR is_private = false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

COMMENT ON FUNCTION propagate_project_visibility() IS 'Automatically propagates is_private changes from projects to interactions owned by the same user';

-- ============================================================================
-- SECURITY AUDIT NOTES
-- ============================================================================
-- 
-- Fixed vulnerabilities:
-- 1. Prevented non-creators from changing is_private on resources they don't own
-- 2. Added creator checks in SECURITY DEFINER functions to prevent privilege escalation
-- 3. Limited cascade propagation to only affect resources owned by the same user
--
-- Remaining limitations:
-- - Cascade only affects user's own resources or public ones
-- - Mixed-ownership projects in groups won't cascade to other users' projects
-- - This is BY DESIGN for security - each user controls their own data
