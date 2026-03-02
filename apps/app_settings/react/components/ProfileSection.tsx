import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import type { UserProfile, Locale } from '@/lib/api/users';
import { patchMe } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

const LOCALE_OPTIONS: { value: Locale; labelKey: string }[] = [
  { value: 'en', labelKey: 'settings.localeEn' },
  { value: 'fr', labelKey: 'settings.localeFr' },
  { value: 'de', labelKey: 'settings.localeDe' },
  { value: 'es', labelKey: 'settings.localeEs' },
];

interface ProfileSectionProps {
  user: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export function ProfileSection({ user, onUserUpdate }: ProfileSectionProps) {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [displayName, setDisplayName] = React.useState(user.display_name ?? '');
  const [locale, setLocale] = React.useState<Locale>((user.locale as Locale) ?? 'en');
  const [saving, setSaving] = React.useState(false);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    const prevLocale = user.locale as Locale;
    try {
      const updated = await patchMe({ display_name: displayName.trim(), locale });
      onUserUpdate(updated);

      if (locale !== prevLocale) {
        window.location.reload();
        return;
      }

      document.body.dispatchEvent(new CustomEvent('profile-updated'));
      toast({ description: t('settings.profileUpdated', { defaultValue: 'Profile updated.' }), variant: 'success' });
    } catch {
      toast({ description: t('settings.requestFailed', { defaultValue: 'Save failed.' }), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.profileTitle', { defaultValue: 'Profile' })}</CardTitle>
        <CardDescription>{t('settings.displayNameDescription')}</CardDescription>
      </CardHeader>
      <CardContent>
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
                <option key={opt.value} value={opt.value}>{t(opt.labelKey)}</option>
              ))}
            </select>
          </div>
          <Button size="sm" type="submit" disabled={saving}>
            {saving ? t('settings.updating') : t('common.save', { defaultValue: 'Save' })}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
