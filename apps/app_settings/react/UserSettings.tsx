import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import type { UserProfile, Theme, ColorTheme, Locale } from '@/lib/api/users';
import { patchMe, changePassword, uploadAvatar, deleteAvatar } from '@/lib/api/users';
import type { Household, HouseholdInvitation } from '@/lib/api/households';
import { useToast } from '@/lib/toast';
import { HouseholdManagement } from './components/HouseholdManagement';
import { PendingInvitations } from './components/PendingInvitations';

interface UserSettingsProps {
  initialUser: UserProfile;
  initialHouseholds: Household[];
  activeHouseholdId?: string | null;
  switchHouseholdUrl?: string;
  initialPendingInvitations?: HouseholdInvitation[];
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

const COLOR_THEME_OPTIONS: { value: ColorTheme; label: string; swatch: string }[] = [
  { value: 'theme-house',    label: 'House',    swatch: '#7c6d5a' },
  { value: 'theme-blue',     label: 'Blue',     swatch: '#0ea5e9' },
  { value: 'theme-sass',     label: 'Sass',     swatch: '#cd5c8e' },
  { value: 'theme-sass2',    label: 'Sage',     swatch: '#5c8a5c' },
  { value: 'theme-sass3',    label: 'Sky',      swatch: '#60a5fa' },
  { value: 'theme-purple',   label: 'Purple',   swatch: '#a855f7' },
  { value: 'theme-green',    label: 'Green',    swatch: '#22c55e' },
  { value: 'theme-crimson',  label: 'Crimson',  swatch: '#dc2626' },
  { value: 'theme-teal',     label: 'Teal',     swatch: '#14b8a6' },
  { value: 'theme-amber',    label: 'Amber',    swatch: '#f59e0b' },
  { value: 'theme-indigo',   label: 'Indigo',   swatch: '#6366f1' },
  { value: 'theme-rose',     label: 'Rose',     swatch: '#f43f5e' },
  { value: 'theme-cyan',     label: 'Cyan',     swatch: '#06b6d4' },
  { value: 'theme-slate',    label: 'Slate',    swatch: '#64748b' },
  { value: 'theme-emerald',  label: 'Emerald',  swatch: '#10b981' },
  { value: 'theme-lavender', label: 'Lavender', swatch: '#a78bfa' },
  { value: 'theme-midnight', label: 'Midnight', swatch: '#4338ca' },
];

/** Apply dark/light/system to <html> classList (Tailwind darkMode: ["class"]) */
function applyDarkMode(theme: string) {
  const html = document.documentElement;
  html.classList.remove('dark');
  if (theme === 'dark') {
    html.classList.add('dark');
  } else if (theme === 'system') {
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      html.classList.add('dark');
    }
  }
}

/** Swap the color palette class on <body> */
function applyColorTheme(colorTheme: string) {
  document.body.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) document.body.classList.remove(cls);
  });
  document.body.classList.add(colorTheme);
}

export default function UserSettings({ initialUser, initialHouseholds, activeHouseholdId, switchHouseholdUrl, initialPendingInvitations = [] }: UserSettingsProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [user, setUser] = React.useState<UserProfile>(initialUser);
  const [households] = React.useState<Household[]>(initialHouseholds);

  // Apply initial theme to <html>
  React.useEffect(() => {
    applyDarkMode(initialUser.theme ?? 'system');
  }, [initialUser.theme]);

  // Theme state
  const [theme, setTheme] = React.useState<Theme>((initialUser.theme as Theme) ?? 'system');
  const [themeSaving, setThemeSaving] = React.useState(false);

  // Color theme state
  const [colorTheme, setColorTheme] = React.useState<ColorTheme>(
    (initialUser.color_theme as ColorTheme) ?? 'theme-house',
  );
  const [colorThemeSaving, setColorThemeSaving] = React.useState(false);

  // Profile state
  const [displayName, setDisplayName] = React.useState(initialUser.display_name ?? '');
  const [locale, setLocale] = React.useState<Locale>((initialUser.locale as Locale) ?? 'en');
  const [profileSaving, setProfileSaving] = React.useState(false);

  // Avatar state
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const [avatarSaving, setAvatarSaving] = React.useState(false);

  // Password state
  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [passwordSaving, setPasswordSaving] = React.useState(false);

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

      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.profileUpdated', { defaultValue: 'Profile updated.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setProfileSaving(false);
    }
  }

  // --- Theme save ---
  async function handleThemeChange(newTheme: Theme) {
    setTheme(newTheme);
    applyDarkMode(newTheme);
    setThemeSaving(true);
    try {
      const updated = await patchMe({ theme: newTheme });
      setUser(updated);
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setThemeSaving(false);
    }
  }

  // --- Color theme save ---
  async function handleColorThemeChange(newColorTheme: ColorTheme) {
    setColorTheme(newColorTheme);
    applyColorTheme(newColorTheme);
    setColorThemeSaving(true);
    try {
      const updated = await patchMe({ color_theme: newColorTheme });
      setUser(updated);
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setColorThemeSaving(false);
    }
  }

  // --- Avatar upload ---
  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast({ description: t('settings.avatarUnsupportedType'), variant: 'destructive' });
      return;
    }
    setAvatarSaving(true);
    try {
      const result = await uploadAvatar(file);
      setUser((prev) => ({ ...prev, avatar: result.avatar_url }));
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarUpdated'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Upload failed.' }), variant: 'destructive' });
    } finally {
      setAvatarSaving(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  async function handleAvatarDelete() {
    setAvatarSaving(true);
    try {
      await deleteAvatar();
      setUser((prev) => ({ ...prev, avatar: null }));
      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.avatarRemoved'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Delete failed.' }), variant: 'destructive' });
    } finally {
      setAvatarSaving(false);
    }
  }

  // --- Password change ---
  async function handlePasswordChange(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ description: t('settings.passwordMismatch'), variant: 'destructive' });
      return;
    }
    setPasswordSaving(true);
    try {
      await changePassword(newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast({ description: t('settings.passwordUpdated'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Failed.' }), variant: 'destructive' });
    } finally {
      setPasswordSaving(false);
    }
  }

  const currentAvatarUrl = user.avatar;
  const initials = (user.display_name || user.email).slice(0, 2).toUpperCase();

  return (
    <div className="space-y-6 max-w-2xl">
      {/* Pending invitations */}
      <PendingInvitations initialInvitations={initialPendingInvitations} />

      {/* Household Management */}
      <HouseholdManagement
        initialHouseholds={households}
        currentUserId={user.id}
        activeHouseholdId={activeHouseholdId}
        switchHouseholdUrl={switchHouseholdUrl}
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
        </CardContent>
      </Card>

      {/* Theme */}
      <Card>
        <CardHeader>
          <CardTitle>{t('settings.theme')}</CardTitle>
          <CardDescription>{t('settings.themeDescription')}</CardDescription>
        </CardHeader>
        <CardContent className="space-y-5">
          {/* Light / Dark / System */}
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

          {/* Color palette */}
          <div>
            <p className="text-sm font-medium mb-2">{t('settings.colorPalette', { defaultValue: 'Color palette' })}</p>
            <div className="flex flex-wrap gap-2">
              {COLOR_THEME_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  title={opt.label}
                  disabled={colorThemeSaving}
                  onClick={() => void handleColorThemeChange(opt.value)}
                  className={`w-8 h-8 rounded-full border-2 transition-all ${
                    colorTheme === opt.value
                      ? 'border-foreground scale-110 shadow-md'
                      : 'border-transparent hover:scale-105'
                  }`}
                  style={{ backgroundColor: opt.swatch }}
                  aria-pressed={colorTheme === opt.value}
                  aria-label={opt.label}
                />
              ))}
            </div>
          </div>
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
