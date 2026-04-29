import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/axios';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';

export default function ForgotPasswordPage() {
  const { t } = useTranslation();
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      await api.post('/accounts/auth/password-reset/', { email });
    } catch {
      // Volontairement silencieux : on n'expose jamais de différence entre
      // email connu / inconnu / erreur réseau pour cacher l'enum d'utilisateurs.
    } finally {
      setSubmitted(true);
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t('auth.forgotPasswordTitle')}</h1>

        {submitted ? (
          <p className="text-sm text-muted-foreground">{t('auth.resetEmailSent')}</p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <p className="text-sm text-muted-foreground">{t('auth.forgotPasswordIntro')}</p>
            <Input
              type="email"
              placeholder={t('auth.email')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              inputMode="email"
            />
            <Button type="submit" className="w-full" disabled={loading}>
              {loading ? t('auth.sending') : t('auth.sendResetLink')}
            </Button>
          </form>
        )}

        <Link to="/login" className="block text-sm text-primary hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      </div>
    </div>
  );
}
