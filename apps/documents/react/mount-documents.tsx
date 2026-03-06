import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DocumentsPage from './DocumentsPage';

type DocumentsPageProps = {
  householdId?: string | null;
};

onDomReady(() => {
  mountWithJsonScriptProps<DocumentsPageProps>('documents-root', 'documents-props', DocumentsPage, { withToaster: true });
});
