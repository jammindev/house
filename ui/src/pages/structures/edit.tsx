import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import StructureForm from '../../../../apps/directory/react/StructureForm';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof StructureForm>, 'mode'>;

function StructureEditForm(props: Props) {
  return <StructureForm {...props} mode="edit" />;
}

onDomReady(() => {
  mountWithJsonScriptProps<Props>('structure-edit-root', 'structure-edit-props', StructureEditForm, { withToaster: true });
});
