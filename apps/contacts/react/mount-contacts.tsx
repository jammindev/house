import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import ContactsNode from './ContactsNode';

type ContactsProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<ContactsProps>('contacts-root', 'contacts-props', ContactsNode);
});
