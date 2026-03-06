import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import StructureForm from './StructureForm';
import type { ComponentProps } from 'react';

type Props = Omit<ComponentProps<typeof StructureForm>, 'mode'>;

function StructureCreateForm(props: Props) {
  return <StructureForm {...props} mode="create" />;
}

onDomReady(() => {
  mountWithJsonScriptProps<Props>('structure-new-root', 'structure-new-props', StructureCreateForm, { withToaster: true });
});
