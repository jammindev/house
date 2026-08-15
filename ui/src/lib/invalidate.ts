import * as React from 'react';
import { useQueryClient } from '@tanstack/react-query';

/**
 * Ce qu'une écriture rend périmé — **déclaré une fois, pour toute l'app**.
 *
 * Une donnée du foyer n'est presque jamais lue par un seul écran. Une tâche
 * cochée change la liste des tâches, « Ma semaine » du dashboard, le compteur
 * d'onglets de son projet et la pastille d'alertes. Tant que chaque mutation
 * énumérait *elle-même* les caches à rafraîchir, ces listes ont dérivé — et
 * toujours dans le même sens, celui de l'oubli :
 *
 * - **rien n'invalidait `dashboard`** hors la création de tâche depuis les
 *   actions rapides : cocher une tâche, saisir une note ou créer un projet
 *   laissait le tableau de bord sur ses chiffres d'avant ;
 * - **rien n'invalidait `alerts`** : une tâche en retard terminée gardait sa
 *   pastille ;
 * - **rien n'invalidait `projects` depuis l'argent**, alors que le coût réel
 *   d'un chantier est la somme de ses dépenses ;
 * - et neuf composants appelaient l'API d'écriture **en direct**, sans passer
 *   par un hook : là, aucun cache n'était touché du tout.
 *
 * Le symptôme est toujours le même et toujours invisible en revue : « je dois
 * recharger la page pour voir mon changement ». Il est amplifié par le
 * `staleTime` de cinq minutes du `QueryClient` (et par `refetchOnWindowFocus:
 * false`) : sans invalidation, rien ne rattrape l'oubli avant l'expiration.
 * Baisser ce `staleTime` masquerait le défaut au prix d'une requête à chaque
 * montage — on préfère le corriger.
 *
 * D'où la règle, identique à celle de l'argent (`money/invalidate.ts`, dont ce
 * module est la généralisation) : **une écriture déclare la racine qu'elle
 * écrit, jamais la liste des caches à rafraîchir.** Ce qui se déduit de cette
 * racine est calculé ici, à partir du graphe ci-dessous.
 */

/**
 * Les racines de cache de l'app — le premier segment de toute `queryKey`.
 *
 * Déclarées en dur pour que `useInvalidate('taks')` soit une erreur de
 * compilation et pas un rafraîchissement silencieusement sans effet.
 */
export const QUERY_ROOTS = [
  'agent',
  'alerts',
  'banking',
  'briefings',
  'budget',
  'chickens',
  'compliance',
  'contacts',
  'dashboard',
  'digest',
  'documents',
  'electricity',
  'equipment',
  'expenses',
  'games',
  'household-members',
  'households',
  'insurance',
  'interactions',
  'notifications',
  'orchard',
  'photos',
  'projects',
  'recap',
  'renovation',
  'settings',
  'shopping',
  'stock',
  'structures',
  'tasks',
  'trackers',
  'water',
  'zones',
] as const;

export type QueryRoot = (typeof QUERY_ROOTS)[number];

/** Les cinq caches que l'argent partage — voir `money/invalidate.ts`. */
const MONEY_ROOTS = ['banking', 'interactions', 'expenses', 'budget', 'compliance'] as const;

/**
 * Ce que chaque racine **lit chez les autres**.
 *
 * Le sens de lecture compte : on déclare « le dashboard est construit à partir
 * des tâches, des interactions et des projets », pas « une tâche rafraîchit le
 * dashboard ». C'est la question à laquelle on sait répondre en écrivant un
 * écran, et c'est donc celle qui ne sera pas oubliée.
 *
 * **Ajouter une vue dérivée, c'est ajouter sa ligne ici.** Sans elle, l'écran
 * s'affichera juste après sa première écriture puis mentira jusqu'à la fin du
 * `staleTime`. Le sens inverse (« qu'est-ce que mon écriture périme ? ») est
 * calculé — c'est lui qu'on oubliait.
 */
const DERIVED_FROM: Partial<Record<QueryRoot, readonly QueryRoot[]>> = {
  /** « Ma semaine », l'activité récente, les projets actifs. */
  dashboard: ['tasks', 'interactions', 'projects', 'orchard'],
  /**
   * Retards, garanties, entretiens, seuils de stock — `apps/alerts/services.py`.
   * `chickens` y entre avec les corvées récurrentes : cocher « nettoyé » repousse
   * l'échéance, donc retire l'alerte. Sans cette ligne, la pastille reste rouge
   * jusqu'à l'expiration du `staleTime`, et le foyer apprend à ne plus la croire.
   */
  alerts: ['tasks', 'equipment', 'stock', 'chickens', 'orchard'],
  /** `actual_cost` = somme des dépenses ; `tab_counts` compte les tâches. */
  projects: ['interactions', 'tasks'],
  /** Le carnet de rénovation *est* une liste d'`Interaction` (kind=renovation). */
  renovation: ['interactions'],
  /**
   * La fiche d'une zone montre son activité, ses tâches et ses photos — et,
   * depuis le parcours 30, les sujets du verger qu'elle contient. Un arbre y
   * pointe par une FK **obligatoire** : planter ou arracher change ce que la
   * zone affiche, et le compteur qui refuse sa suppression.
   */
  zones: ['interactions', 'tasks', 'photos', 'orchard'],
  /** Une photo est un `Document` : les deux vues lisent la même table. */
  photos: ['documents'],
  documents: ['photos'],
  /** Les suggestions de courses viennent des seuils de stock… */
  shopping: ['stock'],
  /** …et cocher un article de la liste ajuste la quantité en stock. */
  stock: ['shopping', 'interactions'],
  /** La fiche d'un équipement montre son historique d'achats et d'entretiens. */
  equipment: ['interactions'],
  /** L'argent : cinq caches pour une seule donnée. */
  banking: MONEY_ROOTS,
  interactions: MONEY_ROOTS,
  expenses: MONEY_ROOTS,
  budget: MONEY_ROOTS,
  compliance: MONEY_ROOTS,
};

/** Graphe inversé — pour une racine écrite, ce qui la lit (un seul saut). */
const READERS: Map<QueryRoot, Set<QueryRoot>> = (() => {
  const readers = new Map<QueryRoot, Set<QueryRoot>>(
    QUERY_ROOTS.map((root) => [root, new Set<QueryRoot>()]),
  );
  for (const [derived, sources] of Object.entries(DERIVED_FROM)) {
    for (const source of sources ?? []) {
      readers.get(source)?.add(derived as QueryRoot);
    }
  }
  return readers;
})();

const CLOSURE = new Map<QueryRoot, readonly QueryRoot[]>();

/**
 * Fermeture transitive : ce qu'une écriture sur `root` rend périmé, `root`
 * compris.
 *
 * Transitive et pas directe, parce que la dérivation se chaîne : ventiler une
 * ligne bancaire écrit des dépenses, qui changent le coût d'un projet, qui
 * s'affiche sur le dashboard. Un seul saut se serait arrêté aux dépenses, et
 * l'écart aurait reparu deux écrans plus loin.
 */
function staleAfterWriting(root: QueryRoot): readonly QueryRoot[] {
  const cached = CLOSURE.get(root);
  if (cached) return cached;

  const seen = new Set<QueryRoot>([root]);
  const queue: QueryRoot[] = [root];
  while (queue.length > 0) {
    const current = queue.shift() as QueryRoot;
    for (const reader of READERS.get(current) ?? []) {
      if (seen.has(reader)) continue;
      seen.add(reader);
      queue.push(reader);
    }
  }

  const result = [...seen];
  CLOSURE.set(root, result);
  return result;
}

/**
 * Les racines à rafraîchir après avoir écrit `written` — exposé pour les tests
 * et pour les rares appelants hors composant.
 */
export function rootsInvalidatedBy(...written: readonly QueryRoot[]): QueryRoot[] {
  const all = new Set<QueryRoot>();
  for (const root of written) {
    for (const stale of staleAfterWriting(root)) all.add(stale);
  }
  return [...all];
}

/**
 * Rafraîchir ce qu'une écriture périme.
 *
 * ```ts
 * const invalidate = useInvalidate();
 * useMutation({ mutationFn: createTask, onSuccess: () => invalidate('tasks') });
 * ```
 *
 * On passe **ce qu'on écrit**, pas ce qu'on veut rafraîchir : une mutation qui
 * touche deux entités (acheter un article de stock crée une dépense) les
 * déclare toutes les deux — `invalidate('stock', 'interactions')`.
 */
export function useInvalidate() {
  const queryClient = useQueryClient();
  // `useCallback` pour que la fonction soit stable d'un rendu à l'autre : elle
  // est appelée depuis tant d'endroits qu'elle finira dans un tableau de
  // dépendances, et une fonction recréée à chaque rendu y boucle.
  return React.useCallback(
    (...written: readonly QueryRoot[]) => {
      for (const root of rootsInvalidatedBy(...written)) {
        void queryClient.invalidateQueries({ queryKey: [root] });
      }
    },
    [queryClient],
  );
}
