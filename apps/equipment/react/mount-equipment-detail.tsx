import type { ComponentProps } from 'react';

import EquipmentDetail from './EquipmentDetail';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type EquipmentDetailProps = ComponentProps<typeof EquipmentDetail>;

onDomReady(() => {
  mountWithJsonScriptProps<EquipmentDetailProps>(
    'equipment-detail-root',
    'equipment-detail-props',
    EquipmentDetail,
    { withToaster: true }
  );
});
