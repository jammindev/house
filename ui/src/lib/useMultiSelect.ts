import * as React from 'react';

export interface MultiSelect<T extends string> {
  /** Mode sélection actif — les clics cochent au lieu d'ouvrir. */
  active: boolean;
  enter: () => void;
  /** Sort du mode **et** vide la sélection. */
  exit: () => void;
  /** Ids cochés, bornés aux ids disponibles et **dans leur ordre**. */
  selectedIds: T[];
  count: number;
  isSelected: (id: T) => boolean;
  toggle: (id: T) => void;
  selectAll: () => void;
  clear: () => void;
  allSelected: boolean;
}

/**
 * Sélection multiple d'une liste ou d'une grille — le mécanisme, sans le métier.
 *
 * Générique à dessein : la file « À ranger » de l'argent porte sa propre copie de
 * ces quatre lignes (`Set<string>`, toggle, tout sélectionner, effacer) et rien ne
 * garantissait que la suivante ait les mêmes garde-fous. Les deux qui comptent :
 *
 * - **La sélection est dérivée des ids disponibles**, jamais recopiée puis nettoyée
 *   par un effet. Un élément qui quitte l'écran (supprimé, sorti du filtre) quitte la
 *   sélection au même rendu — une action de masse sur ce que l'utilisateur ne voit
 *   plus est un dégât qu'aucun écran n'explique.
 * - **Changer de portée vide la sélection** (`scopeKey`). Cocher douze photos « sans
 *   zone » puis basculer sur « Salon » laisserait sinon douze cases cochées
 *   invisibles, et le lot suivant porterait sur autre chose que ce qu'on croit.
 *
 * @param availableIds ids actuellement affichés, dans l'ordre de l'écran
 * @param options.scopeKey identité du contexte (filtres, tri…) : toute variation vide
 *   la sélection sans refermer le mode — l'utilisateur est encore en train de trier.
 */
export function useMultiSelect<T extends string>(
  availableIds: readonly T[],
  options: { scopeKey?: string } = {},
): MultiSelect<T> {
  const { scopeKey = '' } = options;
  const [active, setActive] = React.useState(false);
  const [picked, setPicked] = React.useState<ReadonlySet<T>>(() => new Set<T>());

  React.useEffect(() => {
    setPicked(new Set<T>());
  }, [scopeKey]);

  const selectedIds = React.useMemo(
    () => availableIds.filter((id) => picked.has(id)),
    [availableIds, picked],
  );

  const isSelected = React.useCallback((id: T) => picked.has(id), [picked]);

  const toggle = React.useCallback((id: T) => {
    setPicked((previous) => {
      const next = new Set(previous);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const clear = React.useCallback(() => setPicked(new Set<T>()), []);

  const selectAll = React.useCallback(
    () => setPicked(new Set(availableIds)),
    [availableIds],
  );

  const exit = React.useCallback(() => {
    setActive(false);
    setPicked(new Set<T>());
  }, []);

  return {
    active,
    enter: React.useCallback(() => setActive(true), []),
    exit,
    selectedIds,
    count: selectedIds.length,
    isSelected,
    toggle,
    selectAll,
    clear,
    // Une liste vide n'est pas « toute sélectionnée » : le bouton bascule
    // proposerait « Effacer » alors qu'il n'y a rien à effacer.
    allSelected: availableIds.length > 0 && selectedIds.length === availableIds.length,
  };
}
