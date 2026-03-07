import type { ComponentProps } from 'react';

import ProjectForm from '../../../apps/projects/react/ProjectForm';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type ProjectFormProps = ComponentProps<typeof ProjectForm>;

onDomReady(() => {
  mountWithJsonScriptProps<ProjectFormProps>(
    'projects-form-root',
    'projects-form-props',
    ProjectForm,
    { withToaster: true }
  );
});
