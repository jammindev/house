import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { api } from '@/lib/axios';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';
import { AuthShell } from './AuthShell';

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
    <AuthShell
      title={t('auth.forgotPasswordTitle')}
      // L'intro explique quoi saisir : une fois l'envoi fait, elle décrirait un
      // geste déjà accompli juste au-dessus de sa confirmation.
      subtitle={submitted ? undefined : t('auth.forgotPasswordIntro')}
      footer={
        <Link to="/login" className="text-primary hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      }
    >
      {submitted ? (
        <p className="text-sm text-muted-foreground">{t('auth.resetEmailSent')}</p>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-3">
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
    </AuthShell>
  );
}
