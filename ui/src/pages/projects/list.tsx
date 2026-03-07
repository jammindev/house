import type { ComponentProps } from 'react';

import ProjectList from '../../../../apps/projects/react/ProjectList';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ProjectListProps = ComponentProps<typeof ProjectList>;

onDomReady(() => {
  mountWithJsonScriptProps<ProjectListProps>(
    'projects-list-root',
    'projects-list-props',
    ProjectList,
    { withToaster: true }
  );
});
