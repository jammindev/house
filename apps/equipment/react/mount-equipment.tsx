import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import EquipmentNode from './EquipmentNode';

type EquipmentProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<EquipmentProps>('equipment-root', 'equipment-props', EquipmentNode);
});
