import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import DocumentsNode from './DocumentsNode';

type DocumentsProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<DocumentsProps>('documents-root', 'documents-props', DocumentsNode, { withToaster: true });
});
