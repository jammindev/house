import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import { Alert, AlertDescription } from '@/design-system/alert';
import type { UserProfile, Theme, Locale } from '@/lib/api/users';
import { patchMe, changePassword, uploadAvatar, deleteAvatar } from '@/lib/api/users';
import type { Household } from '@/lib/api/households';
import { HouseholdManagement } from './components/HouseholdManagement';

interface UserSettingsProps {
  initialUser: UserProfile;
  initialHouseholds: Household[];
}

const LOCALE_OPTIONS: { value: Locale; label: string }[] = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'de', label: 'Deutsch' },
  { value: 'es', label: 'Español' },
];

const THEME_OPTIONS: { value: Theme; label: string }[] = [
  { value: 'light', label: 'Light' },
  { value: 'dark', label: 'Dark' },
  { value: 'system', label: 'System' },
];

export default function UserSettings({ initialUser, initialHouseholds }: UserSettingsProps) {
  const { t } = useTranslation();

  const [user, setUser] = React.useState<UserProfile>(initialUser);
  const [households] = React.useState<Household[]>(initialHouseholds);

  // Apply initial theme to <html>
  React.useEffect(() => {
    const theme = initialUser.theme ?? 'system';
    document.documentElement.setAttribute('data-theme', theme);
  }, [initialUser.theme]);

  // Profile state
  const [displayName, setDisplayName] = React.useState(initialUser.display_name ?? '');
  const [locale, setLocale] = React.useState<Locale>((initialUser.locale as Locale) ?? 'en');
  const [profileSaving, setProfileSaving] = React.useState(false);
  const [profileMsg, setProfileMsg] = React.useState<{ text: string; isError: boolean } | null>(null);

  // Theme state
  const [theme, setTheme] = React.useState<Theme>((initialUser.theme as Theme) ?? 'system');
  const [themeSaving, setThemeSaving] = React.useState(false);
  const [themeMsg, setThemeMsg] = React.useState<{ text: string; isError: boolean } | null>(null);

  // Avatar state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarSaving, setAvatarSaving] = React.useState(false);
  const [avatarMsg, setAvatarMsg] = React.useState<{ text: string; isError: boolean } | null>(null);

  // Password state
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordSaving, setPasswordSaving] = React.useState(false);
  const [passwordMsg, setPasswordMsg] = React.useState<{ text: string; isError: boolean } | null>(null);

  function flash(
    setter: React.Dispatch<React.SetStateAction<{ text: string; isError: boolean } | null>>,
    text: string,
    isError = false
  ) {
    setter({ text, isError });
    setTimeout(() => setter(null), 4000);
  }

  // --- Profile save ---
  async function handleProfileSave(e: React.FormEvent) {
    e.preventDefault();
    setProfileSaving(true);
    const prevLocale = user.locale as Locale;
    try {
      const updated = await patchMe({ display_name: displayName.trim(), locale });
      setUser(updated);

      // Si la langue a changé, rediriger vers la page paramètres avec le bon
      // préfixe d'URL (ex. /fr/app/settings/ ou /app/settings/ pour l'anglais).
      // UserLocaleMiddleware activera la bonne langue côté serveur dès cette requête.
      if (locale !== prevLocale) {
        const langPrefix = locale === 'en' ? '' : `/${locale}`;
        window.location.href = `${langPrefix}/app/settings/`;
        return;
      }

      flash(setProfileMsg, t('settings.profileUpdated', { defaultValue: 'Profile updated.' }));
    } catch {
      flash(setProfileMsg, t('settings.requestFailed', { defaultValue: 'Save failed.' }), true);
    } finally {
      setProfileSaving(false);
    }
  }

  // --- Theme save ---
  async function handleThemeChange(newTheme: Theme) {
    setTheme(newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
    setThemeSaving(true);
    try {
      const updated = await patchMe({ theme: newTheme });
      setUser(updated);
      flash(setThemeMsg, t('settings.themeUpdated'));
    } catch {
      flash(setThemeMsg, t('settings.requestFailed', { defaultValue: 'Save failed.' }), true);
    } finally {
      setThemeSaving(false);
    }
  }

  // --- Avatar upload ---
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      flash(setAvatarMsg, t('settings.avatarUnsupportedType'), true);
      return;
    }
    setAvatarSaving(true);
    try {
      const result = await uploadAvatar(file);
      setUser((prev) => ({ ...prev, avatar_url: result.avatar_url, avatar: result.avatar_url }));
      flash(setAvatarMsg, t('settings.avatarUpdated'));
    } catch (err) {
      flash(setAvatarMsg, err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Upload failed.' }), true);
    } finally {
      setAvatarSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    setAvatarSaving(true);
    try {
      await deleteAvatar();
      setUser((prev) => ({ ...prev, avatar_url: '', avatar: null }));
      flash(setAvatarMsg, t('settings.avatarRemoved'));
    } catch (err) {
      flash(setAvatarMsg, err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Delete failed.' }), true);
    } finally {
      setAvatarSaving(false);
    }
  }

  // --- Password change ---
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      flash(setPasswordMsg, t('settings.passwordMismatch'), true);
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');
      flash(setPasswordMsg, t('settings.passwordUpdated'));
    } catch (err) {
      flash(
        setPasswordMsg,
        err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Failed.' }),
        true
      );
    } finally {
      setPasswordSaving(false);
    }
  }

  const currentAvatarUrl = user.avatar || user.avatar_url;
  const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Household Management */}
      <HouseholdManagement
        initialHouseholds={households}
        currentUserId={user.id}
      />

      {/* Profile */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.profileTitle', { defaultValue: 'Profile' })}</CardTitle>
          <CardDescription>{t('settings.displayNameDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handleProfileSave(e)} className="space-y-4">
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
            {profileMsg && (
              <Alert variant={profileMsg.isError ? 'destructive' : 'default'}>
                <AlertDescription>{profileMsg.text}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={profileSaving}>
              {profileSaving ? t('settings.updating') : t('common.save', { defaultValue: 'Save' })}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Avatar */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.avatar')}</CardTitle>
          <CardDescription>{t('settings.avatarDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
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
                  disabled={avatarSaving}
                >
                  {avatarSaving ? t('settings.updating') : t('settings.avatarUpload', { defaultValue: 'Upload' })}
                </Button>
                {currentAvatarUrl && (
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => void handleAvatarDelete()}
                    disabled={avatarSaving}
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
          {avatarMsg && (
            <Alert variant={avatarMsg.isError ? 'destructive' : 'default'}>
              <AlertDescription>{avatarMsg.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.themeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex gap-2">
            {THEME_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                variant={theme === opt.value ? 'default' : 'outline'}
                size="sm"
                onClick={() => void handleThemeChange(opt.value)}
                disabled={themeSaving}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {themeMsg && (
            <Alert variant={themeMsg.isError ? 'destructive' : 'default'}>
              <AlertDescription>{themeMsg.text}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Change Password */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.changePassword')}</CardTitle>
          <CardDescription>{t('settings.updatePassword')}</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={(e) => void handlePasswordChange(e)} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.newPassword')}</label>
              <Input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t('settings.confirmPassword')}</label>
              <Input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
            </div>
            {passwordMsg && (
              <Alert variant={passwordMsg.isError ? 'destructive' : 'default'}>
                <AlertDescription>{passwordMsg.text}</AlertDescription>
              </Alert>
            )}
            <Button type="submit" disabled={passwordSaving}>
              {passwordSaving ? t('settings.updating') : t('settings.updatePasswordCta')}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* User Details (read-only) */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.userDetails')}</CardTitle>
          <CardDescription>{t('settings.accountInfo')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-2 text-sm">
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">{t('settings.email')}:</span>
            <span className="font-mono">{user.email}</span>
          </div>
          <div className="flex gap-2">
            <span className="text-muted-foreground w-16">{t('settings.userId')}:</span>
            <span className="font-mono text-xs break-all">{user.id}</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
