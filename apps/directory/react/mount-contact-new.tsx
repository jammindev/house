import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';
import ContactCreateForm from './ContactCreateForm';

type Props = {
  redirectUrl?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<Props>('contact-new-root', 'contact-new-props', ContactCreateForm, { withToaster: true });
});
