import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/axios';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';
import { Logo } from '../../design-system/logo';

/**
 * Le premier écran d'une instance neuve — celui qui remplace un mot de passe
 * imprimé dans les logs.
 *
 * Avant, `docker compose up` générait un secret et l'affichait dans un cadre
 * que les logs de gunicorn faisaient défiler en une quinzaine de secondes. Ici,
 * on ouvre l'adresse et on choisit ses identifiants — même pratique que
 * Nextcloud, Home Assistant, Immich ou Gitea. Issue #591.
 */
export default function SetupPage() {
  const { t } = useTranslation();
  const { login } = useAuth();
  const navigate = useNavigate();

  // `null` = on ne sait pas encore. Distinguer les trois états compte : afficher
  // le formulaire avant la réponse le ferait clignoter chez quelqu'un dont
  // l'instance est déjà configurée.
  const [required, setRequired] = useState<boolean | null>(null);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [household, setHousehold] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  useEffect(() => {
    api
      .get<{ required: boolean }>('/accounts/setup/')
      .then((res) => setRequired(res.data.required))
      // Une instance injoignable n'est pas une instance configurée : on renvoie
      // vers la connexion, qui saura le dire à sa façon.
      .catch(() => setRequired(false));
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setPending(true);
    try {
      await api.post('/accounts/setup/', {
        email,
        password,
        household_name: household,
      });
      // On enchaîne sur le `login()` habituel plutôt que sur des jetons renvoyés
      // par la configuration : un seul chemin d'authentification, donc un seul
      // endroit où il peut dériver.
      await login(email, password);
      navigate('/app/dashboard');
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: Record<string, unknown> } })?.response?.data;
      const passwordErrors = detail?.password;
      setError(
        Array.isArray(passwordErrors) && passwordErrors.length
          ? String(passwordErrors[0])
          : t('auth.setupFailed'),
      );
    } finally {
      setPending(false);
    }
  }

  if (required === null) return null;
  if (!required) return <Navigate to="/login" replace />;

  return (
    <div className="flex min-h-dvh items-center justify-center pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
        <div className="flex flex-col items-center gap-3 pb-2 text-foreground">
          <Logo size={44} />
          <span className="text-xl font-semibold tracking-tight">Maisonnée</span>
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold">{t('auth.setupTitle')}</h1>
          <p className="text-sm text-muted-foreground">{t('auth.setupIntro')}</p>
        </div>
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input
          type="email"
          placeholder={t('auth.email')}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          autoComplete="email"
          inputMode="email"
        />
        <Input
          type="password"
          placeholder={t('auth.password')}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          autoComplete="new-password"
        />
        <Input
          type="text"
          placeholder={t('auth.setupHouseholdName')}
          value={household}
          onChange={(e) => setHousehold(e.target.value)}
          autoComplete="off"
        />
        <Button type="submit" className="w-full" disabled={pending}>
          {pending ? t('auth.setupPending') : t('auth.setupSubmit')}
        </Button>
      </form>
    </div>
  );
}
