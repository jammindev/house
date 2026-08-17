import React, { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/axios';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';
import { AuthShell } from './AuthShell';

export default function ResetPasswordPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const uid = params.get('uid') ?? '';
  const token = params.get('token') ?? '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const missingTokenParts = !uid || !token;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (newPassword.length < 8) {
      setError(t('auth.passwordTooShort'));
      return;
    }
    if (newPassword !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }

    setLoading(true);
    try {
      await api.post('/accounts/auth/password-reset/confirm/', {
        uid,
        token,
        new_password: newPassword,
      });
      navigate('/login', { state: { resetSuccess: true } });
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? t('auth.tokenInvalid'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <AuthShell
      title={t('auth.resetPasswordTitle')}
      footer={
        <Link to="/login" className="text-primary hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      }
    >
      {missingTokenParts ? (
        <p className="text-sm text-destructive">{t('auth.tokenInvalid')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
          {error && <p className="text-sm text-destructive">{error}</p>}
          <Input
            type="password"
            placeholder={t('auth.newPassword')}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <Input
            type="password"
            placeholder={t('auth.confirmPassword')}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? t('auth.resetting') : t('auth.resetSubmit')}
          </Button>
        </form>
      )}
    </AuthShell>
  );
}
