import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import i18n from '@/lib/i18n';
import { Pencil, X, Check } from 'lucide-react';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { SettingsSection } from './SettingsSection';
import type { UserProfile, Locale } from '@/lib/api/users';
import { patchMe, uploadAvatar, deleteAvatar } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

interface ProfileSectionProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export function ProfileSection({ user, onUserUpdate }: ProfileSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();
  const qc = useQueryClient();

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [isEditing, setIsEditing] = React.useState(false);
  const [displayName, setDisplayName] = React.useState(user.display_name ?? '');
  const [locale, setLocale] = React.useState<Locale>((user.locale as Locale) ?? 'en');
  const [saving, setSaving] = React.useState(false);
  const [avatarUploading, setAvatarUploading] = React.useState(false);

  const currentAvatarUrl = user.avatar;
  const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

  // Sync with user prop changes
  React.useEffect(() => {
    setDisplayName(user.display_name ?? '');
    setLocale((user.locale as Locale) ?? 'en');
  }, [user.display_name, user.locale]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const prevLocale = user.locale as Locale;
    try {
      const updated = await patchMe({ display_name: displayName.trim(), locale });
      onUserUpdate(updated);
      qc.setQueryData(['settings', 'me'], updated);

      if (locale !== prevLocale) {
        localStorage.setItem('lang', locale);
        await i18n.changeLanguage(locale);
      }

      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.profileUpdated', { defaultValue: 'Profile updated.' }), variant: 'success' });
      setIsEditing(false);
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  function handleCancel() {
    setDisplayName(user.display_name ?? '');
    setLocale((user.locale as Locale) ?? 'en');
    setIsEditing(false);
  }

  function handleEdit() {
    setIsEditing(true);
  }

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ description: t('settings.avatarUnsupportedType'), variant: 'destructive' });
      return;
    }
    setAvatarUploading(true);
    try {
      const result = await uploadAvatar(file);
      onUserUpdate({ ...user, avatar: result.avatar_url });
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarUpdated'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Upload failed.' }), variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    setAvatarUploading(true);
    try {
      await deleteAvatar();
      onUserUpdate({ ...user, avatar: null });
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarRemoved'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Delete failed.' }), variant: 'destructive' });
    } finally {
      setAvatarUploading(false);
    }
  }

  const localeLabel = LOCALE_OPTIONS.find(opt => opt.value === locale)?.label;

  return (
    <SettingsSection
      title={t('settings.profileTitle', { defaultValue: 'Profile' })}
      description={t('settings.displayNameDescription')}
      actions={
        !isEditing ? (
          <Button size="sm" variant="ghost" onClick={handleEdit}>
            <Pencil className="h-4 w-4 mr-2" />
            {t('common.edit', { defaultValue: 'Modifier' })}
          </Button>
        ) : null
      }
    >
      <div className="space-y-6">
        {/* Avatar */}
        <div className="flex items-center gap-4">
          {currentAvatarUrl ? (
            <img
              src={currentAvatarUrl}
              alt={t('settings.avatarAlt')}
              className="w-20 h-20 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="w-20 h-20 rounded-full bg-muted flex items-center justify-center text-xl font-semibold ring-2 ring-border">
              {initials}
            </div>
          )}
          {isEditing && (
            <div className="space-y-2">
              <p className="text-sm text-muted-foreground">{t('settings.avatarHelper', { defaultValue: 'PNG, JPG or WEBP (max 2 MB)' })}</p>
              <div className="flex gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={avatarUploading}
                >
                  {avatarUploading ? t('settings.updating') : t('settings.avatarUpload', { defaultValue: 'Upload photo' })}
                </Button>
                {currentAvatarUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleAvatarDelete()}
                    disabled={avatarUploading}
                  >
                    {t('settings.avatarRemove', { defaultValue: 'Remove' })}
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="hidden"
          onChange={(e) => void handleAvatarChange(e)}
        />

        {/* Read-only mode */}
        {!isEditing && (
          <div className="space-y-3">
            <div>
              <p className="text-base font-medium">{displayName || user.email}</p>
              <p className="text-sm text-muted-foreground">{user.email}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">{localeLabel ?? locale}</p>
            </div>
          </div>
        )}

        {/* Edit mode */}
        {isEditing && (
          <form onSubmit={(e) => void handleSave(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.displayName')}</label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t('settings.displayNamePlaceholder')}
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.language')}</label>
              <select
                value={locale}
                onChange={(e) => setLocale(e.target.value as Locale)}
                className="w-full rounded-md border border-input bg-transparent px-3 py-2 text-sm"
              >
                {LOCALE_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <Button size="sm" type="submit" disabled={saving}>
                <Check className="h-4 w-4 mr-2" />
                {saving ? t('settings.updating') : t('common.save', { defaultValue: 'Save' })}
              </Button>
              <Button size="sm" type="button" variant="outline" onClick={handleCancel} disabled={saving}>
                <X className="h-4 w-4 mr-2" />
                {t('common.cancel', { defaultValue: 'Cancel' })}
              </Button>
            </div>
          </form>
        )}
      </div>
    </SettingsSection>
  );
}
