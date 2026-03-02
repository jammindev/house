import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import type { UserProfile, Theme, ColorTheme } from '@/lib/api/users';
import { patchMe } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

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

function applyColorTheme(colorTheme: string) {
  document.body.classList.forEach((cls) => {
    if (cls.startsWith('theme-')) document.body.classList.remove(cls);
  });
  document.body.classList.add(colorTheme);
}

interface ThemeSectionProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export function ThemeSection({ user, onUserUpdate }: ThemeSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [theme, setTheme] = React.useState<Theme>((user.theme as Theme) ?? 'system');
  const [colorTheme, setColorTheme] = React.useState<ColorTheme>(
    (user.color_theme as ColorTheme) ?? 'theme-house',
  );
  const [themeSaving, setThemeSaving] = React.useState(false);
  const [colorThemeSaving, setColorThemeSaving] = React.useState(false);

  React.useEffect(() => {
    applyDarkMode(user.theme ?? 'system');
  }, [user.theme]);

  async function handleThemeChange(newTheme: Theme) {
    setTheme(newTheme);
    applyDarkMode(newTheme);
    setThemeSaving(true);
    try {
      const updated = await patchMe({ theme: newTheme });
      onUserUpdate(updated);
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setThemeSaving(false);
    }
  }

  async function handleColorThemeChange(newColorTheme: ColorTheme) {
    setColorTheme(newColorTheme);
    applyColorTheme(newColorTheme);
    setColorThemeSaving(true);
    try {
      const updated = await patchMe({ color_theme: newColorTheme });
      onUserUpdate(updated);
      toast({ description: t('settings.themeUpdated'), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setColorThemeSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.theme')}</CardTitle>
        <CardDescription>{t('settings.themeDescription')}</CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        <div className="flex gap-2">
          {THEME_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={theme === opt.value ? 'default' : 'outline'}
              size="sm"
              onClick={() => void handleThemeChange(opt.value)}
              disabled={themeSaving}
            >
              {t(opt.labelKey)}
            </Button>
          ))}
        </div>

        <div>
          <p className="text-sm font-medium mb-2">{t('settings.colorPalette', { defaultValue: 'Color palette' })}</p>
          <div className="flex flex-wrap gap-2">
            {COLOR_THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                title={t(opt.labelKey)}
                disabled={colorThemeSaving}
                onClick={() => void handleColorThemeChange(opt.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  colorTheme === opt.value
                    ? 'border-foreground scale-110 shadow-md'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: opt.swatch }}
                aria-pressed={colorTheme === opt.value}
                aria-label={t(opt.labelKey)}
              />
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
