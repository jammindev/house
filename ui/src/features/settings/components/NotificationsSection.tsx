import { useTranslation } from 'react-i18next';

import { CheckboxField } from '@/design-system/checkbox-field';
import { useMutableNotificationTypes } from '@/features/notifications/hooks';
import { NotificationIcon } from '@/features/notifications/icons';

import { SettingsSection } from './SettingsSection';
import { useCurrentUser, useUpdateProfile } from '../hooks';

/**
 * Ce que l'utilisateur ne veut plus voir dans sa cloche.
 *
 * Opt-OUT : tout arrive par défaut, on ne coche que pour faire taire. Et la
 * liste vient du serveur (`/notifications/mutable-types/`), pas d'un tableau en
 * dur : le backend refuse de faire taire une invitation, donc afficher la case
 * serait promettre un réglage qui ne s'enregistrera pas.
 *
 * Les cases sont des cases « recevoir », pas « masquer » : une liste de
 * négations à cocher pour obtenir un silence se lit à l'envers, et c'est le
 * genre d'inversion qui fait couper ce qu'on voulait garder.
 */
export function NotificationsSection() {
  const { t } = useTranslation();
  const { data: types } = useMutableNotificationTypes();
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  if (!types || types.length === 0) return null;

  const muted = user?.muted_notification_types ?? [];

  function handleToggle(type: string, receive: boolean) {
    const next = receive ? muted.filter((k) => k !== type) : [...muted, type];
    updateProfile.mutate({ muted_notification_types: next });
  }

  return (
    <SettingsSection
      title={t('settings.notifications.title')}
      description={t('settings.notifications.description')}
    >
      <div className="space-y-3">
        {types.map((type) => {
          return (
            <div key={type} className="flex items-center gap-2">
              <NotificationIcon type={type} className="h-4 w-4 shrink-0 text-muted-foreground" />
              <CheckboxField
                id={`notif-${type}`}
                label={t(`notifications.type.${type}`)}
                checked={!muted.includes(type)}
                onChange={(checked) => handleToggle(type, checked)}
              />
            </div>
          );
        })}
      </div>
    </SettingsSection>
  );
}
