import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import ContactDetailsView from './ContactDetailsView';

type Props = {
  contactId: string;
  householdId?: string | null;
  editUrl?: string;
  backUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('contact-detail-root', 'contact-detail-props', ContactDetailsView, { withToaster: true });
});
