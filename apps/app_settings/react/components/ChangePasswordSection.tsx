import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { SettingsSection } from './SettingsSection';
import { changePassword } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

export function ChangePasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPasswords, setShowPasswords] = React.useState(false);
  const [saving, setSaving] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ description: t('settings.passwordMismatch'), variant: 'destructive' });
      return;
    }
    setSaving(true);
    try {
      await changePassword(newPassword, confirmPassword);
      setNewPassword('');
      setConfirmPassword('');
      toast({ description: t('settings.passwordUpdated'), variant: 'success' });
    } catch (err) {
      toast({ description: err instanceof Error ? err.message : t('settings.requestFailed', { defaultValue: 'Failed.' }), variant: 'destructive' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SettingsSection
      title={t('settings.changePassword')}
      description={t('settings.updatePassword')}
    >
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('settings.newPassword')}</label>
              <div className="relative">
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1.5">{t('settings.confirmPassword')}</label>
              <div className="relative">
                <Input
                  type={showPasswords ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  className="pr-10"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={showPasswords}
                onChange={(e) => setShowPasswords(e.target.checked)}
                className="rounded border-gray-300"
              />
              <span className="text-muted-foreground">{t('settings.showPasswords', { defaultValue: 'Show passwords' })}</span>
            </label>
          </div>
          <Button type="submit" disabled={saving || !newPassword || !confirmPassword}>
            {saving ? t('settings.updating') : t('settings.updatePasswordCta')}
          </Button>
        </form>
    </SettingsSection>
  );
}
