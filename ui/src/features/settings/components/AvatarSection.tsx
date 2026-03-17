import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { SettingsSection } from './SettingsSection';
import type { UserProfile } from '@/lib/api/users';
import { uploadAvatar, deleteAvatar } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

interface AvatarSectionProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export function AvatarSection({ user, onUserUpdate }: AvatarSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [saving, setSaving] = React.useState(false);

  const currentAvatarUrl = user.avatar;
  const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ description: t('settings.avatarUnsupportedType'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      const result = await uploadAvatar(file);
      onUserUpdate({ ...user, avatar: result.avatar_url });
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarUpdated'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Upload failed.' }), variant: 'destructive' });
    } finally {
      setSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    setSaving(true);
    try {
      await deleteAvatar();
      onUserUpdate({ ...user, avatar: null });
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarRemoved'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Delete failed.' }), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title={t('settings.avatar')}
      description={t('settings.avatarDescription')}
    >
      <div className="space-y-4">
        <div className="flex items-center gap-4">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={t('settings.avatarAlt')}
              className="w-16 h-16 rounded-full object-cover"
            />
          ) : (
            <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center text-xl font-semibold">
              {initials}
            </div>
          )}
          <div className="space-y-1">
            <p className="text-xs text-muted-foreground">{t('settings.avatarHelper')}</p>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={saving}
              >
                {saving ? t('settings.updating') : t('settings.avatarUpload', { defaultValue: 'Upload' })}
              </Button>
              {currentAvatarUrl && (
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void handleAvatarDelete()}
                  disabled={saving}
                >
                  {t('settings.avatarRemove')}
                </Button>
              )}
            </div>
          </div>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleAvatarChange(e)}
        />
      </div>
    </SettingsSection>
  );
}
