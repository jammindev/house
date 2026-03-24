import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Label } from '@/design-system/label';
import { SettingsSection } from './SettingsSection';
import { useToast } from '@/lib/toast';
import { useChangePassword } from '../hooks';

export function ChangePasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();
  const changePassword = useChangePassword();

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
  const [showPasswords, setShowPasswords] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      toast({ description: t('settings.passwordMismatch'), variant: 'destructive' });
      return;
    }
    await changePassword.mutateAsync({ newPassword, confirmPassword });
    setNewPassword('');
    setConfirmPassword('');
  }

  const saving = changePassword.isPending;

  return (
    <SettingsSection title={t('settings.changePassword')} description={t('settings.updatePassword')}>
      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
        <div className="space-y-4">
          <div>
            <Label className="mb-1.5">{t('settings.newPassword')}</Label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div>
            <Label className="mb-1.5">{t('settings.confirmPassword')}</Label>
            <Input
              type={showPasswords ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={showPasswords}
              onChange={(e) => setShowPasswords(e.target.checked)}
              className="rounded border-gray-300"
            />
            <span className="text-muted-foreground">{t('settings.showPasswords')}</span>
          </label>
        </div>
        <Button type="submit" disabled={saving || !newPassword || !confirmPassword}>
          {saving ? t('settings.updating') : t('settings.updatePasswordCta')}
        </Button>
      </form>
    </SettingsSection>
  );
}
