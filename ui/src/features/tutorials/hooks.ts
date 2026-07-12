import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchMe, patchMe, type UserProfile } from '@/lib/api/users';
import { useDisabledModules } from '@/lib/modules';
import {
  GETTING_STARTED, TUTORIAL_GUIDES,
  type GettingStartedItem, type TutorialGuide,
} from './content';

// Même query key que settingsKeys.me() — cache partagé avec Réglages/Sidebar.
const ME_KEY = ['settings', 'me'] as const;

/** Clés de tutoriels terminées par l'utilisateur (Set pour lookup O(1)). */
export function useCompletedTutorials(): { completed: Set<string>; isLoading: boolean } {
  const query = useQuery<UserProfile>({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  return {
    completed: new Set(query.data?.completed_tutorials ?? []),
    isLoading: query.isLoading,
  };
}

/** Mutation optimiste : coche/décoche une clé — l'UI réagit immédiatement.
 *  `next` est calculé une seule fois dans `toggle` (jamais dans `mutationFn`,
 *  qui verrait le cache déjà modifié par `onMutate`). */
export function useToggleTutorial() {
  const qc = useQueryClient();
  const mutation = useMutation({
    mutationFn: (next: string[]) => patchMe({ completed_tutorials: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ME_KEY });
      const prev = qc.getQueryData<UserProfile>(ME_KEY);
      if (prev) qc.setQueryData(ME_KEY, { ...prev, completed_tutorials: next });
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(ME_KEY, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ME_KEY }),
  });

  const toggle = (key: string) => {
    const current = qc.getQueryData<UserProfile>(ME_KEY)?.completed_tutorials ?? [];
    const next = current.includes(key)
      ? current.filter((k) => k !== key)
      : [...current, key];
    mutation.mutate(next);
  };

  return { toggle };
}

/** Guides et items visibles pour le foyer (modules désactivés masqués). */
export function useVisibleTutorials(): {
  guides: TutorialGuide[];
  startItems: GettingStartedItem[];
  isLoading: boolean;
} {
  const { disabled, isLoading } = useDisabledModules();
  return {
    guides: TUTORIAL_GUIDES.filter((g) => !g.moduleKey || !disabled.has(g.moduleKey)),
    startItems: GETTING_STARTED.filter((i) => !i.moduleKey || !disabled.has(i.moduleKey)),
    isLoading,
  };
}
