import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import ContactEditForm from '../../../../apps/directory/react/ContactEditForm';

type Props = {
  contactId: string;
  backUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('contact-edit-root', 'contact-edit-props', ContactEditForm, { withToaster: true });
});
