import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DocumentDetailPage from '@apps/documents/react/DocumentDetailPage';
import type { DocumentDetail } from '@/lib/api/documents';
import type { InteractionListItem } from '@/lib/api/interactions';

export interface DocumentDetailPageProps {
  documentId: string;
  listUrl: string;
  fileUrl: string | null;
  attachInteractionApiUrl: string;
  createInteractionUrl: string;
  createTaskUrl: string;
  initialDocument: DocumentDetail | null;
  initialRecentInteractionCandidates: InteractionListItem[];
  initialLoaded: boolean;
}

onDomReady(() => {
  mountWithJsonScriptProps<DocumentDetailPageProps>(
    'document-detail-root',
    'document-detail-props',
    DocumentDetailPage,
    { withToaster: true },
  );
});
