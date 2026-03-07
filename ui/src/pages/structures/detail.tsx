import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import StructureDetailView from '../../../../apps/directory/react/StructureDetailView';

type Props = {
  structureId: string;
  editUrl?: string;
  backUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('structure-detail-root', 'structure-detail-props', StructureDetailView, { withToaster: true });
});
