import React from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QrCode } from 'lucide-react';

import { useAuth } from '@/lib/auth/useAuth';
import { toast } from '@/lib/toast';
import { Button } from '@/design-system/button';
import type { ScanVerdict } from '@/lib/api/games';
import { useScanZoneToken } from './hooks';

type Failure = 'unknown' | 'other-household' | 'generic';

/** Le ton du retour de scan — trouver, se tromper, gagner ne se disent pas pareil. */
const SCAN_TONE: Record<ScanVerdict, 'success' | 'destructive' | 'default'> = {
  no_hunt: 'default',
  advanced: 'success',
  finished: 'success',
  already_found: 'default',
  wrong_zone: 'destructive',
};

function failureOf(error: unknown): Failure {
  const status = (error as { response?: { status?: number } })?.response?.status;
  if (status === 404) return 'unknown';
  if (status === 403) return 'other-household';
  return 'generic';
}

/**
 * Page publique derrière une étiquette QR de zone — `/z/<jeton>`.
 *
 * Elle est **dans le SPA et pas côté Django** pour une raison précise :
 * l'authentification de House est un JWT en `localStorage`, qu'une vue serveur
 * ne voit pas. Django ne saurait donc ni vérifier l'appartenance au foyer, ni
 * (au lot 2) faire avancer une chasse. Voir `docs/fiches/ANCRAGE_PHYSIQUE.md`.
 *
 * Le scan lui-même est fait par l'appareil photo natif du téléphone, qui ouvre
 * cette URL : l'app n'embarque aucun décodeur — nginx pose
 * `Permissions-Policy: camera=()` en production.
 */
export default function ZoneScanPage() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { token = '' } = useParams<{ token: string }>();
  const { user, isLoading: authLoading } = useAuth();

  const [failure, setFailure] = React.useState<Failure | null>(null);
  const { mutateAsync: scan } = useScanZoneToken();

  React.useEffect(() => {
    if (authLoading) return;

    // Non connecté : on passe par le login **en gardant la destination**. Sans
    // le `next`, l'étiquette ne marcherait que pour qui est déjà connecté —
    // c'est-à-dire jamais au moment où on la scanne pour la première fois.
    if (!user) {
      navigate(`/login?next=${encodeURIComponent(`/z/${token}`)}`, { replace: true });
      return;
    }

    let cancelled = false;
    scan(token)
      .then(({ zone, verdict, hunt }) => {
        if (cancelled) return;

        // Hors partie, une étiquette est un raccourci vers sa pièce. Pendant une
        // chasse, le même geste est un **coup joué** : on renvoie donc vers
        // l'écran de jeu, qui est la seule vue autorisée à dire où on en est.
        if (verdict !== 'no_hunt') {
          toast({ description: t(`games.scan.${verdict}`), variant: SCAN_TONE[verdict] });
          navigate(hunt ? `/app/games/play?hunt=${hunt.id}` : '/app/games/play', {
            replace: true,
          });
          return;
        }

        navigate(`/app/zones/${zone.id}`, { replace: true });
      })
      .catch((error) => {
        if (cancelled) return;
        setFailure(failureOf(error));
      });

    return () => {
      cancelled = true;
    };
  }, [authLoading, user, token, navigate, scan]);

  if (failure) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-background p-6 text-center">
        <QrCode className="h-10 w-10 text-muted-foreground" aria-hidden />
        <h1 className="text-lg font-semibold text-foreground">
          {t(`zones.qr.failure.${failure}.title`)}
        </h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {t(`zones.qr.failure.${failure}.body`)}
        </p>
        <Button onClick={() => navigate('/app/zones', { replace: true })}>
          {t('zones.qr.backToZones')}
        </Button>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-background p-6">
      <QrCode className="h-8 w-8 animate-pulse text-muted-foreground" aria-hidden />
      <p className="text-sm text-muted-foreground">{t('zones.qr.scanning')}</p>
    </div>
  );
}
