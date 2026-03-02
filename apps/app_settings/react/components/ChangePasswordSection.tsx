import * as React from 'react';
import { useTranslation } from 'react-i18next';

import { Button } from '@/design-system/button';
import { Input } from '@/design-system/input';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/design-system/card';
import { changePassword } from '@/lib/api/users';
import { useToast } from '@/lib/toast';

export function ChangePasswordSection() {
  const { t } = useTranslation();
  const { toast } = useToast();

  const [newPassword, setNewPassword] = React.useState('');
  const [confirmPassword, setConfirmPassword] = React.useState('');
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
    <Card>
      <CardHeader>
        <CardTitle>{t('settings.changePassword')}</CardTitle>
        <CardDescription>{t('settings.updatePassword')}</CardDescription>
      </CardHeader>
      <CardContent>
        <form onSubmit={(e) => void handleSubmit(e)} className="space-y-4">
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
          <Button type="submit" disabled={saving}>
            {saving ? t('settings.updating') : t('settings.updatePasswordCta')}
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
