import type { ComponentProps } from 'react';

import InteractionCreateForm from '@/components/features/InteractionCreateForm';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type InteractionCreateFormProps = ComponentProps<typeof InteractionCreateForm>;

onDomReady(() => {
  mountWithJsonScriptProps<InteractionCreateFormProps>(
    'interaction-create-root',
    'interaction-create-props',
    InteractionCreateForm
  );
});
