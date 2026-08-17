import React, { useEffect, useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/lib/auth/useAuth';
import { api } from '@/lib/axios';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';
import { AuthShell } from './AuthShell';

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
  const [firstName, setFirstName] = useState('');
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
        first_name: firstName,
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
    <AuthShell title={t('auth.setupTitle')} subtitle={t('auth.setupIntro')}>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-sm text-destructive">{error}</p>}
        <Input
          type="text"
          placeholder={t('auth.setupFirstName')}
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          autoComplete="given-name"
        />
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
    </AuthShell>
  );
}
