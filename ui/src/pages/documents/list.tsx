import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import type { DocumentItem } from '@/lib/api/documents';
import DocumentsPage from '@apps/documents/react/DocumentsPage';

type DocumentsPageProps = {
  title?: string;
  createUrl?: string;
  initialDocuments?: DocumentItem[];
  initialLoaded?: boolean;
  initialCounts?: {
    total: number;
    withoutActivity: number;
  };
  filterDefaults?: {
    withoutActivityOnly: boolean;
  };
};

onDomReady(() => {
  mountWithJsonScriptProps<DocumentsPageProps>('documents-root', 'documents-props', DocumentsPage, { withToaster: true });
});
