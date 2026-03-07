import type { ComponentProps } from 'react';

import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

import ZonesNode from '../../../../apps/zones/react/ZonesNode';

type ZonesNodeProps = ComponentProps<typeof ZonesNode>;

onDomReady(() => {
  mountWithJsonScriptProps<ZonesNodeProps>('zones-root', 'zones-page-props', ZonesNode, { withToaster: true });
});
