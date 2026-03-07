import type { ComponentProps } from 'react';

import ProjectGroupList from '../../../../apps/projects/react/ProjectGroupList';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ProjectGroupListProps = ComponentProps<typeof ProjectGroupList>;

onDomReady(() => {
  mountWithJsonScriptProps<ProjectGroupListProps>(
    'project-groups-root',
    'project-groups-props',
    ProjectGroupList,
    { withToaster: true }
  );
});
