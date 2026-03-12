import { createBrowserRouter, RouterProvider, useNavigate, useParams } from 'react-router-dom';

import ProjectList from '../../../../apps/projects/react/ProjectList';
import ProjectDetail from '../../../../apps/projects/react/ProjectDetail';
import ProjectForm from '../../../../apps/projects/react/ProjectForm';
import ProjectGroupList from '../../../../apps/projects/react/ProjectGroupList';
import ProjectGroupDetail from '../../../../apps/projects/react/ProjectGroupDetail';
import { onDomReady, renderRoot } from '@/lib/mount';

const BASENAME = '/app/projects';

// ── Navigation helper ────────────────────────────────────────────────────────

function useProjectNavigate() {
  const navigate = useNavigate();
  return (url: string) => {
    const path = url.startsWith(BASENAME) ? url.slice(BASENAME.length) || '/' : url;
    navigate(path);
  };
}

// ── Route components ─────────────────────────────────────────────────────────

function ProjectListRoute() {
  const onNavigate = useProjectNavigate();
  return <ProjectList onNavigate={onNavigate} />;
}

function ProjectNewRoute() {
  const onNavigate = useProjectNavigate();
  return (
    <ProjectForm
      mode="create"
      cancelUrl={`${BASENAME}/`}
      successRedirectUrl={`${BASENAME}/`}
      onNavigate={onNavigate}
    />
  );
}

function ProjectDetailRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const onNavigate = useProjectNavigate();
  return (
    <ProjectDetail
      projectId={projectId!}
      editUrl={`${BASENAME}/${projectId}/edit/`}
      listUrl={`${BASENAME}/`}
      onNavigate={onNavigate}
    />
  );
}

function ProjectEditRoute() {
  const { projectId } = useParams<{ projectId: string }>();
  const onNavigate = useProjectNavigate();
  return (
    <ProjectForm
      mode="edit"
      projectId={projectId!}
      cancelUrl={`${BASENAME}/${projectId}/`}
      successRedirectUrl={`${BASENAME}/${projectId}/`}
      onNavigate={onNavigate}
    />
  );
}

function ProjectGroupsRoute() {
  const onNavigate = useProjectNavigate();
  return <ProjectGroupList projectsUrl={`${BASENAME}/`} onNavigate={onNavigate} />;
}

function ProjectGroupDetailRoute() {
  const { groupId } = useParams<{ groupId: string }>();
  const onNavigate = useProjectNavigate();
  return (
    <ProjectGroupDetail
      groupId={groupId!}
      backUrl={`${BASENAME}/groups/`}
      onNavigate={onNavigate}
    />
  );
}

// ── Router ───────────────────────────────────────────────────────────────────

const router = createBrowserRouter(
  [
    { path: '/', element: <ProjectListRoute /> },
    { path: '/new/', element: <ProjectNewRoute /> },
    { path: '/:projectId/', element: <ProjectDetailRoute /> },
    { path: '/:projectId/edit/', element: <ProjectEditRoute /> },
    { path: '/groups/', element: <ProjectGroupsRoute /> },
    { path: '/groups/:groupId/', element: <ProjectGroupDetailRoute /> },
  ],
  { basename: BASENAME },
);

// ── Mount ────────────────────────────────────────────────────────────────────

onDomReady(() => {
  const mountNode = document.getElementById('projects-spa-root');
  if (!mountNode) return;
  renderRoot(mountNode, <RouterProvider router={router} />, { withToaster: true });
});
