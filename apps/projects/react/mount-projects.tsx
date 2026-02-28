import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import ProjectsNode from './ProjectsNode';

type ProjectsProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<ProjectsProps>('projects-root', 'projects-props', ProjectsNode, { withToaster: true });
});
