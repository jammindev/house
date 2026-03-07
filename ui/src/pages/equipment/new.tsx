import type { ComponentProps } from 'react';

import EquipmentForm from '../../../../apps/equipment/react/EquipmentForm';
import { mountWithJsonScriptProps, onDomReady } from '@/lib/mount';

type EquipmentFormProps = ComponentProps<typeof EquipmentForm>;

onDomReady(() => {
  mountWithJsonScriptProps<EquipmentFormProps>('equipment-form-root', 'equipment-form-props', EquipmentForm, {
    withToaster: true,
  });
});
