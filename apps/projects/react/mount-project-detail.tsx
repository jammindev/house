import type { ComponentProps } from 'react';

import ProjectDetail from './ProjectDetail';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ProjectDetailProps = ComponentProps<typeof ProjectDetail>;

onDomReady(() => {
  mountWithJsonScriptProps<ProjectDetailProps>(
    'projects-detail-root',
    'projects-detail-props',
    ProjectDetail,
    { withToaster: true }
  );
});
