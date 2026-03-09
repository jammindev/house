import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import DocumentCreatePage from '@apps/documents/react/DocumentCreatePage';

export interface DocumentCreatePageProps {
  title: string;
  cancelUrl: string;
  allowedTypes: Array<{ value: string; label: string }>;
  defaultType: string | null;
  uploadApiUrl: string;
  successRedirectMode: 'document-detail';
}

onDomReady(() => {
  mountWithJsonScriptProps<DocumentCreatePageProps>(
    'document-create-root',
    'document-create-props',
    DocumentCreatePage,
    { withToaster: true },
  );
});
