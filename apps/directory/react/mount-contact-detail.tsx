import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import ContactDetailsView from './ContactDetailsView';

type Props = {
  contactId: string;
  editUrl?: string;
  backUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('contact-detail-root', 'contact-detail-props', ContactDetailsView, { withToaster: true });
});
