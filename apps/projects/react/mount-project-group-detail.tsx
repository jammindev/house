import type { ComponentProps } from 'react';

import ProjectGroupDetail from './ProjectGroupDetail';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ProjectGroupDetailProps = ComponentProps<typeof ProjectGroupDetail>;

onDomReady(() => {
  mountWithJsonScriptProps<ProjectGroupDetailProps>(
    'project-group-detail-root',
    'project-group-detail-props',
    ProjectGroupDetail,
    { withToaster: true }
  );
});
