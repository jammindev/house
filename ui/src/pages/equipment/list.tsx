import type { ComponentProps } from 'react';

import EquipmentList from '../../../../apps/equipment/react/EquipmentList';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type EquipmentListProps = ComponentProps<typeof EquipmentList>;

onDomReady(() => {
  mountWithJsonScriptProps<EquipmentListProps>(
    'equipment-list-root',
    'equipment-list-props',
    EquipmentList,
    { withToaster: true }
  );
});
