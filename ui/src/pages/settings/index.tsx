import type { ComponentProps } from 'react';
import { onDomReady, mountWithJsonScriptProps } from '@/lib/mount';

import UserSettings from '../../../../apps/app_settings/react/UserSettings';

type UserSettingsProps = ComponentProps<typeof UserSettings>;

onDomReady(() => {
  mountWithJsonScriptProps<UserSettingsProps>(
    'settings-root',
    'settings-props',
    UserSettings,
    { withToaster: true }
  );
});
