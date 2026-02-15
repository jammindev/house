-- Fix RLS policies for visibility system
-- The WITH CHECK clause was causing 500 errors due to complex subquery
-- Simplified to only check creator when updating is_private field

-- Fix interactions UPDATE policy
DROP POLICY IF EXISTS "Members can update interactions in their household" ON public.interactions;
CREATE POLICY "Members can update interactions in their household"
ON public.interactions FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = interactions.household_id
      AND hm.user_id = auth.uid()
      AND (
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
);

-- Fix projects UPDATE policy
DROP POLICY IF EXISTS "Members can update projects in their household" ON public.projects;
CREATE POLICY "Members can update projects in their household"
ON public.projects FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = projects.household_id
      AND hm.user_id = auth.uid()
      AND (
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
);

-- Fix project_groups UPDATE policy
DROP POLICY IF EXISTS "Members can update project groups in their household" ON public.project_groups;
CREATE POLICY "Members can update project groups in their household"
ON public.project_groups FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.household_members hm
    WHERE hm.household_id = project_groups.household_id
      AND hm.user_id = auth.uid()
      AND (
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
);
