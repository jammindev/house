import type { ComponentProps } from 'react';

import InteractionList from './InteractionList';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type InteractionListProps = ComponentProps<typeof InteractionList>;

onDomReady(() => {
  mountWithJsonScriptProps<InteractionListProps>(
    'interactions-list-root',
    'interactions-list-props',
    InteractionList,
    { withToaster: true }
  );
});
