import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { SettingsSection } from './SettingsSection';
import type { Theme, ColorTheme } from '@/lib/api/users';
import { useToast } from '@/lib/toast';
import { applyDarkMode, applyColorTheme } from '@/lib/theme';
import { useCurrentUser, useUpdateProfile } from '../hooks';

const THEME_OPTIONS: { value: Theme; labelKey: string }[] = [
  { value: 'light', labelKey: 'settings.themeLight' },
  { value: 'dark', labelKey: 'settings.themeDark' },
  { value: 'system', labelKey: 'settings.themeSystem' },
];

const COLOR_THEME_OPTIONS: { value: ColorTheme; labelKey: string; swatch: string }[] = [
  { value: 'theme-house',    labelKey: 'settings.colorThemeHouse',    swatch: '#7c6d5a' },
  { value: 'theme-blue',     labelKey: 'settings.colorThemeBlue',     swatch: '#0ea5e9' },
  { value: 'theme-sass',     labelKey: 'settings.colorThemeSass',     swatch: '#cd5c8e' },
  { value: 'theme-sass2',    labelKey: 'settings.colorThemeSage',     swatch: '#5c8a5c' },
  { value: 'theme-sass3',    labelKey: 'settings.colorThemeSky',      swatch: '#60a5fa' },
  { value: 'theme-purple',   labelKey: 'settings.colorThemePurple',   swatch: '#a855f7' },
  { value: 'theme-green',    labelKey: 'settings.colorThemeGreen',    swatch: '#22c55e' },
  { value: 'theme-crimson',  labelKey: 'settings.colorThemeCrimson',  swatch: '#dc2626' },
  { value: 'theme-teal',     labelKey: 'settings.colorThemeTeal',     swatch: '#14b8a6' },
  { value: 'theme-amber',    labelKey: 'settings.colorThemeAmber',    swatch: '#f59e0b' },
  { value: 'theme-indigo',   labelKey: 'settings.colorThemeIndigo',   swatch: '#6366f1' },
  { value: 'theme-rose',     labelKey: 'settings.colorThemeRose',     swatch: '#f43f5e' },
  { value: 'theme-cyan',     labelKey: 'settings.colorThemeCyan',     swatch: '#06b6d4' },
  { value: 'theme-slate',    labelKey: 'settings.colorThemeSlate',    swatch: '#64748b' },
  { value: 'theme-emerald',  labelKey: 'settings.colorThemeEmerald',  swatch: '#10b981' },
  { value: 'theme-lavender', labelKey: 'settings.colorThemeLavender', swatch: '#a78bfa' },
  { value: 'theme-midnight', labelKey: 'settings.colorThemeMidnight', swatch: '#4338ca' },
];

export function ThemeSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const { data: user } = useCurrentUser();
  const updateProfile = useUpdateProfile();

  const currentTheme = (user?.theme as Theme) ?? 'system';
  const currentColorTheme = (user?.color_theme as ColorTheme) ?? 'theme-house';

  // Apply theme on user data change
  React.useEffect(() => {
    if (user?.theme) applyDarkMode(user.theme);
  }, [user?.theme]);

  async function handleThemeChange(newTheme: Theme) {
    if (newTheme === currentTheme) return;
    applyDarkMode(newTheme);
    try {
      await updateProfile.mutateAsync({ theme: newTheme });
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  }

  async function handleColorThemeChange(newColorTheme: ColorTheme) {
    if (newColorTheme === currentColorTheme) return;
    applyColorTheme(newColorTheme);
    try {
      await updateProfile.mutateAsync({ color_theme: newColorTheme });
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed'), variant: 'destructive' });
    }
  }

  const saving = updateProfile.isPending;

  return (
    <SettingsSection title={t('settings.theme')} description={t('settings.themeDescription')}>
      <div className="space-y-5">
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={currentTheme === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => void handleThemeChange(opt.value)}
              disabled={saving}
            >
              {t(opt.labelKey)}
            </Button>
          ))}
        </div>

        <div>
          <p className="mb-2 text-sm font-medium">{t('settings.colorPalette')}</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                title={t(opt.labelKey)}
                disabled={saving || currentColorTheme === opt.value}
                onClick={() => void handleColorThemeChange(opt.value)}
                className={`h-8 w-8 rounded-full border-2 transition-all ${
                  currentColorTheme === opt.value
                    ? 'scale-110 border-foreground shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: opt.swatch }}
                aria-pressed={currentColorTheme === opt.value}
                aria-label={t(opt.labelKey)}
              />
            ))}
          </div>
        </div>
      </div>
    </SettingsSection>
  );
}
