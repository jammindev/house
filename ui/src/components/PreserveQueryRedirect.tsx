import { Navigate, useLocation } from 'react-router-dom';

interface PreserveQueryRedirectProps {
  /** Chemin de destination, sans query string. */
  to: string;
}

/**
 * Redirige vers `to` **en conservant la query string** de l'URL d'origine.
 *
 * `<Navigate to="/app/money/recurring" />` la perd, et ce n'est pas un détail :
 * l'agent produit `/app/budget/recurring?r={id}`
 * (`apps/budget/apps.py::SearchableSpec.url_template`). Sans le paramètre, un lien
 * qui ouvrait *une* récurrence ouvre la liste — le lien reste valide et devient
 * faux, ce qui est le pire des deux.
 *
 * Le pendant pour les anciennes URLs de la famille argent est
 * `MoneyTabRedirect`, qui lit en plus `?tab=` pour choisir la page d'arrivée.
 */
export default function PreserveQueryRedirect({ to }: PreserveQueryRedirectProps) {
  const location = useLocation();
  return <Navigate to={`${to}${location.search}${location.hash}`} replace />;
}
