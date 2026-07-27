import * as React from 'react';

/**
 * Une liste qu'on **parcourt**, par pages.
 *
 * Deux mécanismes coexistent dans le module argent, et la différence n'est pas
 * cosmétique :
 *
 * - le journal et les dépenses sont des registres qu'on **consulte** : ils
 *   grandissent sans fin (116 lignes par relevé mensuel), donc leur parcours doit
 *   être sans plafond. C'est ce hook.
 * - la file « À ranger » et un groupe du Contrôle sont des piles qu'on **vide** :
 *   les lignes disparaissent à mesure qu'on les traite, et changer de page pendant
 *   que la précédente se vide fait sauter des lignes. C'est `useLoadMore`.
 *
 * L'agrandissement de fenêtre, lui, ne pouvait pas servir aux registres : le
 * serveur plafonne à 100 (dépenses) et 200 (journal), donc le bouton aurait cessé
 * d'avancer sans le dire — un mur déplacé plus loin, pas un mur supprimé.
 *
 * `resetKey` ramène à la première page quand les filtres changent : rester
 * page 4 d'une liste qui n'en a plus qu'une afficherait un vide inexplicable.
 */
export function usePager(pageSize: number, resetKey?: unknown) {
  const [offset, setOffset] = React.useState(0);

  React.useEffect(() => {
    setOffset(0);
  }, [resetKey, pageSize]);

  return {
    limit: pageSize,
    offset,
    reset: React.useCallback(() => setOffset(0), []),
    next: React.useCallback(() => setOffset((o) => o + pageSize), [pageSize]),
    previous: React.useCallback(() => setOffset((o) => Math.max(0, o - pageSize)), [pageSize]),
  };
}
