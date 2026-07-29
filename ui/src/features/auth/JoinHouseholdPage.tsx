import React, { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';

import { useAuth } from '@/lib/auth/useAuth';
import { Button } from '../../design-system/button';
import { Input } from '../../design-system/input';
import { FormField } from '../../design-system/form-field';
import { fetchInvitationPreview, joinHousehold, type InvitationPreview } from '@/lib/api/households';

function errorDetail(error: unknown, fallback: string): string {
  const detail = (error as { response?: { data?: { detail?: unknown } } })?.response?.data?.detail;
  return typeof detail === 'string' ? detail : fallback;
}

/**
 * Public page behind a shared invitation link.
 *
 * This is the only way into House for somebody who has no account: there is no
 * open signup, by design — you get in because a household invited you.
 */
export default function JoinHouseholdPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token = '' } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();

  const [preview, setPreview] = useState<InvitationPreview | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(true);

  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetchInvitationPreview(token)
      .then((data) => {
        if (cancelled) return;
        setPreview(data);
        // An addressed invitation pins the account to its address.
        if (data.email) setEmail(data.email);
      })
      .catch((err: unknown) => {
        if (!cancelled) setLoadError(errorDetail(err, t('invitations.linkInvalid')));
      })
      .finally(() => {
        if (!cancelled) setLoadingPreview(false);
      });
    return () => {
      cancelled = true;
    };
  }, [token, t]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await joinHousehold(token, {
        email: preview?.email || email,
        password,
        display_name: displayName,
      });
      // The server hands back a token pair so the new member is already logged
      // in — landing them on /login to retype the password they just chose would
      // waste the only moment they are certain of it.
      if (result.access && result.refresh) {
        localStorage.setItem('access_token', result.access);
        localStorage.setItem('refresh_token', result.refresh);
      }
      window.location.assign('/app/dashboard');
    } catch (err: unknown) {
      setError(errorDetail(err, t('invitations.joinFailed')));
    } finally {
      setSubmitting(false);
    }
  }

  /** Already logged in: no account to create, one click to accept. */
  async function handleAcceptAsCurrentUser() {
    setError(null);
    setSubmitting(true);
    try {
      await joinHousehold(token);
      window.location.assign('/app/dashboard');
    } catch (err: unknown) {
      setError(errorDetail(err, t('invitations.joinFailed')));
      setSubmitting(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="flex min-h-dvh items-center justify-center px-4 pt-[env(safe-area-inset-top)] pb-[env(safe-area-inset-bottom)]">
      <div className="w-full max-w-sm space-y-4">{children}</div>
    </div>
  );

  if (loadingPreview || authLoading) {
    return shell(<div className="h-32 animate-pulse rounded-lg bg-muted" />);
  }

  if (loadError || !preview) {
    return shell(
      <>
        <h1 className="text-2xl font-semibold">{t('invitations.linkInvalidTitle')}</h1>
        <p className="text-sm text-muted-foreground">{loadError ?? t('invitations.linkInvalid')}</p>
        <Link to="/login" className="block text-sm text-primary hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      </>
    );
  }

  if (preview.is_expired) {
    return shell(
      <>
        <h1 className="text-2xl font-semibold">{t('invitations.expiredTitle')}</h1>
        <p className="text-sm text-muted-foreground">{t('invitations.expiredBody')}</p>
        <Link to="/login" className="block text-sm text-primary hover:underline">
          ← {t('auth.backToLogin')}
        </Link>
      </>
    );
  }

  const heading = (
    <div className="space-y-1">
      <h1 className="text-2xl font-semibold">
        {t('invitations.joinTitle', { name: preview.household_name })}
      </h1>
      <p className="text-sm text-muted-foreground">
        {preview.invited_by_name
          ? t('invitations.joinSubtitleBy', { name: preview.invited_by_name })
          : t('invitations.joinSubtitle')}
      </p>
    </div>
  );

  if (user) {
    return shell(
      <>
        {heading}
        {error && <p className="text-sm text-destructive">{error}</p>}
        <p className="text-sm text-muted-foreground">
          {t('invitations.joinAsCurrentUser', { email: user.email })}
        </p>
        <Button
          type="button"
          className="w-full"
          disabled={submitting}
          onClick={() => void handleAcceptAsCurrentUser()}
        >
          {submitting ? t('common.saving') : t('invitations.joinSubmit')}
        </Button>
        <Link to="/app/dashboard" className="block text-sm text-primary hover:underline">
          {t('invitations.notNow')}
        </Link>
      </>
    );
  }

  return shell(
    <>
      {heading}
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="text-sm text-destructive">{error}</p>}

        <FormField label={t('invitations.displayName')} htmlFor="join-display-name">
          <Input
            id="join-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            autoComplete="name"
          />
        </FormField>

        <FormField label={t('auth.email')} htmlFor="join-email">
          <Input
            id="join-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            inputMode="email"
            // Pinned by the invitation: changing it here would silently create an
            // account under an address the household never invited.
            readOnly={Boolean(preview.email)}
          />
        </FormField>

        <FormField label={t('invitations.choosePassword')} htmlFor="join-password">
          <Input
            id="join-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="new-password"
            minLength={8}
          />
        </FormField>

        <Button type="submit" className="w-full" disabled={submitting}>
          {submitting ? t('common.saving') : t('invitations.joinSubmit')}
        </Button>
      </form>

      <p className="text-sm text-muted-foreground">
        {t('invitations.alreadyHaveAccount')}{' '}
        <button
          type="button"
          className="text-primary hover:underline"
          // Comes back here after logging in — a login that lands on the
          // dashboard would quietly drop the invitation they were acting on.
          onClick={() => navigate(`/login?next=${encodeURIComponent(`/join/${token}`)}`)}
        >
          {t('auth.login')}
        </button>
      </p>
    </>
  );
}
