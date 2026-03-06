import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import StructureDetailView from './StructureDetailView';

type Props = {
  structureId: string;
  householdId?: string | null;
  editUrl?: string;
  backUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('structure-detail-root', 'structure-detail-props', StructureDetailView, { withToaster: true });
});
