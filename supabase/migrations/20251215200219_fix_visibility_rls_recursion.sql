-- FIX: Visibility RLS policies security issues
-- 
-- PROBLEM: Previous policies allowed any household member to change is_private
-- SOLUTION: Split into 2 policies per table - one for creators, one for other members

-- ============================================================================
-- FIX PROJECTS UPDATE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Members can update projects in their household" ON public.projects;

CREATE POLICY "Creators can update their projects"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
  )
  AND projects.created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
  )
  AND projects.created_by = auth.uid()
);

CREATE POLICY "Members can update non-private projects"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
  )
  AND projects.is_private = false
  AND projects.created_by != auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
  )
  AND projects.is_private = false
  AND projects.created_by != auth.uid()
);

-- ============================================================================
-- FIX PROJECT_GROUPS UPDATE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Members can update project groups in their household" ON public.project_groups;

CREATE POLICY "Creators can update their project groups"
ON public.project_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
  )
  AND project_groups.created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
  )
  AND project_groups.created_by = auth.uid()
);

CREATE POLICY "Members can update non-private project groups"
ON public.project_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
  )
  AND project_groups.is_private = false
  AND project_groups.created_by != auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
  )
  AND project_groups.is_private = false
  AND project_groups.created_by != auth.uid()
);

-- ============================================================================
-- FIX INTERACTIONS UPDATE POLICIES
-- ============================================================================
DROP POLICY IF EXISTS "Members can update interactions in their household" ON public.interactions;

CREATE POLICY "Creators can update their interactions"
ON public.interactions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
  )
  AND interactions.created_by = auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
  )
  AND interactions.created_by = auth.uid()
);

CREATE POLICY "Members can update non-private interactions"
ON public.interactions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
  )
  AND interactions.is_private = false
  AND interactions.created_by != auth.uid()
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
  )
  AND interactions.is_private = false
  AND interactions.created_by != auth.uid()
);

-- ============================================================================
-- FIX SECURITY DEFINER FUNCTIONS
-- ============================================================================

CREATE OR REPLACE FUNCTION propagate_project_group_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    IF NEW.created_by = auth.uid() THEN
      UPDATE public.projects
      SET is_private = NEW.is_private
      WHERE project_group_id = NEW.id
        AND (created_by = auth.uid() OR is_private = false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION propagate_project_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    IF NEW.created_by = auth.uid() THEN
      UPDATE public.interactions
      SET is_private = NEW.is_private
      WHERE project_id = NEW.id
        AND (created_by = auth.uid() OR is_private = false);
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
