-- Add is_private column to projects, project_groups, and interactions
-- Default to false (household visible), only creator can see when true

-- Add is_private to projects
ALTER TABLE public.projects
ADD COLUMN is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.projects.is_private IS 'When true, only the creator can see this project. When false (default), all household members can see it.';

-- Add is_private to project_groups
ALTER TABLE public.project_groups
ADD COLUMN is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.project_groups.is_private IS 'When true, only the creator can see this group. When false (default), all household members can see it.';

-- Add is_private to interactions
ALTER TABLE public.interactions
ADD COLUMN is_private boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.interactions.is_private IS 'When true, only the creator can see this interaction. When false (default), all household members can see it.';

-- Create indexes for performance on filtered queries
CREATE INDEX idx_projects_household_visibility ON public.projects(household_id, is_private);
CREATE INDEX idx_project_groups_household_visibility ON public.project_groups(household_id, is_private);
CREATE INDEX idx_interactions_household_visibility ON public.interactions(household_id, is_private);

-- Update RLS policies for projects
DROP POLICY IF EXISTS "Members can view projects in their household" ON public.projects;
CREATE POLICY "Members can view projects in their household"
ON public.projects FOR SELECT
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
);

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
  AND (
    -- Only creator can change is_private
    (is_private = (SELECT p.is_private FROM public.projects p WHERE p.id = projects.id))
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can delete projects in their household" ON public.projects;
CREATE POLICY "Members can delete projects in their household"
ON public.projects FOR DELETE
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
);

-- Update RLS policies for project_groups
DROP POLICY IF EXISTS "Members can view project groups in their household" ON public.project_groups;
CREATE POLICY "Members can view project groups in their household"
ON public.project_groups FOR SELECT
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
);

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
  AND (
    -- Only creator can change is_private
    (is_private = (SELECT pg.is_private FROM public.project_groups pg WHERE pg.id = project_groups.id))
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can delete project groups in their household" ON public.project_groups;
CREATE POLICY "Members can delete project groups in their household"
ON public.project_groups FOR DELETE
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
);

-- Update RLS policies for interactions
DROP POLICY IF EXISTS "Members can view interactions in their household" ON public.interactions;
CREATE POLICY "Members can view interactions in their household"
ON public.interactions FOR SELECT
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
);

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
  AND (
    -- Only creator can change is_private
    (is_private = (SELECT i.is_private FROM public.interactions i WHERE i.id = interactions.id))
    OR created_by = auth.uid()
  )
);

DROP POLICY IF EXISTS "Members can delete interactions in their household" ON public.interactions;
CREATE POLICY "Members can delete interactions in their household"
ON public.interactions FOR DELETE
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
);

-- Create function to cascade is_private from project_group to projects
CREATE OR REPLACE FUNCTION propagate_project_group_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    UPDATE public.projects
    SET is_private = NEW.is_private
    WHERE project_group_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project_group visibility propagation
DROP TRIGGER IF EXISTS trg_propagate_project_group_visibility ON public.project_groups;
CREATE TRIGGER trg_propagate_project_group_visibility
AFTER UPDATE OF is_private ON public.project_groups
FOR EACH ROW
EXECUTE FUNCTION propagate_project_group_visibility();

-- Create function to cascade is_private from project to interactions
CREATE OR REPLACE FUNCTION propagate_project_visibility()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.is_private IS DISTINCT FROM OLD.is_private THEN
    UPDATE public.interactions
    SET is_private = NEW.is_private
    WHERE project_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for project visibility propagation
DROP TRIGGER IF EXISTS trg_propagate_project_visibility ON public.projects;
CREATE TRIGGER trg_propagate_project_visibility
AFTER UPDATE OF is_private ON public.projects
FOR EACH ROW
EXECUTE FUNCTION propagate_project_visibility();

-- Add comment on triggers
COMMENT ON FUNCTION propagate_project_group_visibility() IS 'Automatically propagates is_private changes from project_groups to all projects in that group';
COMMENT ON FUNCTION propagate_project_visibility() IS 'Automatically propagates is_private changes from projects to all linked interactions';
