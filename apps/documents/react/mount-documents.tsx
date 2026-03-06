import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DocumentsPage from './DocumentsPage';

type DocumentsPageProps = Record<string, never>;

onDomReady(() => {
  mountWithJsonScriptProps<DocumentsPageProps>('documents-root', 'documents-props', DocumentsPage, { withToaster: true });
});
