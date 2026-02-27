import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import SettingsNode from './SettingsNode';

type SettingsProps = {
  section?: string;
};

onDomReady(() => {
  mountWithJsonScriptProps<SettingsProps>('settings-root', 'settings-props', SettingsNode);
});
