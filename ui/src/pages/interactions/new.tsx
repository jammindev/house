import type { ComponentProps } from 'react';

import InteractionCreateForm from '../../../../apps/interactions/react/InteractionCreateForm';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type InteractionCreateFormProps = ComponentProps<typeof InteractionCreateForm>;

onDomReady(() => {
  mountWithJsonScriptProps<InteractionCreateFormProps>(
    'interaction-create-root',
    'interaction-create-props',
    InteractionCreateForm,
    { withToaster: true }
  );
});
