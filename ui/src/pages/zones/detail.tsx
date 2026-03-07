import type { ComponentProps } from 'react';

import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

import ZoneDetailNode from '../../../../apps/zones/react/ZoneDetailNode';

type ZoneDetailNodeProps = ComponentProps<typeof ZoneDetailNode>;

onDomReady(() => {
  mountWithJsonScriptProps<ZoneDetailNodeProps>('zone-detail-root', 'zone-detail-page-props', ZoneDetailNode, {
    withToaster: true,
  });
});
