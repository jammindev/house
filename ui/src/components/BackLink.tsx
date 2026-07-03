import { Link } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { ArrowLeft } from 'lucide-react';
import { useBackTarget } from '@/lib/backNavigation';

interface BackLinkProps {
  /** Route de repli quand la page est ouverte directement (URL, nouvel onglet). */
  fallback: string;
  /** Libellé quand on retombe sur le fallback (ex: titre de la liste). */
  fallbackLabel: string;
}

export default function BackLink({ fallback, fallbackLabel }: BackLinkProps) {
  const { t } = useTranslation();
  const { to, state, hasOrigin } = useBackTarget(fallback);

  return (
    <Link
      to={to}
      state={state}
      className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="h-4 w-4" />
      {hasOrigin ? t('common.back') : fallbackLabel}
    </Link>
  );
}
