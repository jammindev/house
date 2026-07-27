import * as React from 'react';

/**
 * Une liste plafonnée qui sait s'agrandir.
 *
 * Le module argent affichait ses quatre listes avec un `limit` en dur — 50 pour
 * le journal, les dépenses et la file, 25 pour un groupe du Contrôle — et **aucun
 * moyen d'aller plus loin**. Sur un relevé réel de 116 lignes, deux tiers du
 * travail étaient hors d'atteinte, et le Contrôle allait jusqu'à annoncer « et 66
 * de plus… » sans offrir de les voir. Un compteur qui nomme ce qu'il cache est
 * pire qu'un compteur muet.
 *
 * On agrandit la fenêtre plutôt que d'empiler des pages (`useInfiniteQuery`) pour
 * deux raisons concrètes : la forme du cache reste `{items, count}`, celle que le
 * retrait optimiste d'une dépense manipule (`LinkedLineActions`), et une
 * invalidation continue de rafraîchir *toute* la liste visible d'un coup — sur
 * de l'argent, une page rafraîchie et trois périmées serait un piège.
 *
 * `resetKey` remet la fenêtre à sa taille de départ quand les filtres changent :
 * garder 300 lignes de large après avoir filtré sur un compte ne servirait qu'à
 * ralentir la requête suivante.
 */
export function useLoadMore(pageSize = 50, resetKey?: unknown, maxLimit = 200) {
  const [limit, setLimit] = React.useState(pageSize);

  React.useEffect(() => {
    setLimit(pageSize);
  }, [pageSize, resetKey]);

  const loadMore = React.useCallback(() => {
    // Borné au plafond du serveur : demander 250 quand il en rend 200 ferait un
    // bouton qui ne bouge plus, sans rien dire.
    setLimit((current) => Math.min(current + pageSize, maxLimit));
  }, [pageSize, maxLimit]);

  return { limit, loadMore, maxLimit };
}
