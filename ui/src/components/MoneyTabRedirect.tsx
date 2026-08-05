import { Navigate, useLocation } from 'react-router-dom';
import { resolveMoneyRedirect, type LegacyMoneyTab } from '@/lib/moneyRedirect';

interface MoneyTabRedirectProps {
  /** Onglet visé quand l'URL n'en porte pas — l'ancienne page qu'on remplace. */
  tab?: LegacyMoneyTab;
}

/**
 * Redirige `/app/money` (et les trois anciennes pages `/app/banking`,
 * `/app/expenses`, `/app/budget`) vers la page qui porte désormais le contenu.
 *
 * Deux points justifient un composant plutôt qu'un `<Navigate to>` en dur :
 *
 * - **la query string est préservée**. Un favori, ou un lien produit avant
 *   l'éclatement, peut porter n'importe quel paramètre — `?b={id}` ouvrait *un*
 *   budget. Le perdre transforme un lien précis en lien approximatif, ce qui est
 *   pire qu'un lien mort : il continue de marcher, en montrant autre chose ;
 * - **`?tab=` décide de la destination**, au lieu d'échouer dans un coin de
 *   l'URL. `/app/money?tab=budgets` était l'adresse des budgets pour l'agent et
 *   pour les guides du tutoriel ; c'est elle qui doit atterrir sur `/budgets`.
 *
 * La résolution vit dans `lib/moneyRedirect` — elle se teste sans routeur.
 */
export default function MoneyTabRedirect({ tab }: MoneyTabRedirectProps) {
  const location = useLocation();
  return <Navigate to={resolveMoneyRedirect(location.search, tab, location.hash)} replace />;
}
