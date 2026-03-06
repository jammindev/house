import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import ContactCreateForm from './ContactCreateForm';

type Props = {
  householdId?: string | null;
  redirectUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('contact-new-root', 'contact-new-props', ContactCreateForm, { withToaster: true });
});
