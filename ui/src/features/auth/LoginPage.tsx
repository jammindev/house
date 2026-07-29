import React, { useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';

/**
 * Where to land after login. Only same-site absolute paths are honoured — a
 * `next` pointing at another host would turn the login page into an open
 * redirect.
 */
function safeNext(raw: string | null): string {
  if (!raw) return '/app/dashboard';
  // Must be a single-slash absolute path. `//host` is protocol-relative, and
  // browsers normalise `\` to `/`, so `/\host` is the same trick spelled twice.
  if (!raw.startsWith('/') || raw.startsWith('//') || /[\\]/.test(raw)) return '/app/dashboard';
  return raw;
}

export default function LoginPage() {
  const { t } = useTranslation();
  const { login, user } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeNext(params.get('next'));
  const resetSuccess = (location.state as { resetSuccess?: boolean } | null)?.resetSuccess;
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (user) {
    navigate(next);
    return null;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
      navigate(next);
    } catch {
      setError(t('auth.invalidCredentials'));
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">{t('auth.login')}</h1>
        {resetSuccess && <p className="text-sm text-primary">{t('auth.passwordResetSuccess')}</p>}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input type="email" placeholder={t('auth.email')} value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" inputMode="email" />
        <Input type="password" placeholder={t('auth.password')} value={password} onChange={(e) => setPassword(e.target.value)} required autoComplete="current-password" />
        <Button type="submit" className="w-full" disabled={loading}>
          {loading ? t('auth.loggingIn') : t('auth.submit')}
        </Button>
        <Link to="/forgot-password" className="block text-center text-sm text-primary hover:underline">
          {t('auth.forgotPassword')}
        </Link>
      </form>
    </div>
  );
}
