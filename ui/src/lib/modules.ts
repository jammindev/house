import {
  Bird, Box, Droplets, FileText, FolderKanban, Image, ListTodo, MapPin,
  Notebook, Receipt, TrendingUp, Umbrella, Users, Wrench, Zap,
  type LucideIcon,
} from 'lucide-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth/useAuth';
import { fetchHouseholds, type Household } from '@/lib/api/households';
import { fetchMe, patchMe, type UserProfile } from '@/lib/api/users';

/**
 * Registry unique des entrées de navigation « module » (parcours 15).
 * Consommé par la Sidebar, la section Réglages « Modules » et le guard de
 * route. Les clés doivent rester identiques à
 * apps/households/modules.py (OPTIONAL_MODULES / PINNABLE_MODULES).
 */

export type ModuleGroup = 'home' | 'tracking' | 'resources';

export interface ModuleDef {
  key: string;
  to: string;
  labelKey: string;
  Icon: LucideIcon;
  group: ModuleGroup;
  /** Désactivable par l'owner du foyer (Household.disabled_modules). */
  optional: boolean;
}

export const MODULE_GROUPS: { key: ModuleGroup; labelKey: string }[] = [
  { key: 'home', labelKey: 'sidebar.groupHome' },
  { key: 'tracking', labelKey: 'sidebar.groupTracking' },
  { key: 'resources', labelKey: 'sidebar.groupResources' },
];

export const MODULES: ModuleDef[] = [
  { key: 'zones',        to: '/app/zones',        labelKey: 'zones.title',        Icon: MapPin,       group: 'home',      optional: false },
  { key: 'equipment',    to: '/app/equipment',    labelKey: 'equipment.title',    Icon: Wrench,       group: 'home',      optional: false },
  { key: 'electricity',  to: '/app/electricity',  labelKey: 'electricity.title',  Icon: Zap,          group: 'home',      optional: true  },
  { key: 'water',        to: '/app/water',        labelKey: 'water.title',        Icon: Droplets,     group: 'home',      optional: true  },
  { key: 'stock',        to: '/app/stock',        labelKey: 'stock.title',        Icon: Box,          group: 'home',      optional: true  },
  { key: 'chickens',     to: '/app/chickens',     labelKey: 'chickens.title',     Icon: Bird,         group: 'home',      optional: true  },
  { key: 'insurance',    to: '/app/insurance',    labelKey: 'insurance.title',    Icon: Umbrella,     group: 'home',      optional: true  },
  { key: 'tasks',        to: '/app/tasks',        labelKey: 'tasks.title',        Icon: ListTodo,     group: 'tracking',  optional: false },
  { key: 'projects',     to: '/app/projects',     labelKey: 'projects.title',     Icon: FolderKanban, group: 'tracking',  optional: false },
  { key: 'interactions', to: '/app/interactions', labelKey: 'interactions.title', Icon: Notebook,     group: 'tracking',  optional: false },
  { key: 'trackers',     to: '/app/trackers',     labelKey: 'trackers.title',     Icon: TrendingUp,   group: 'tracking',  optional: true  },
  { key: 'expenses',     to: '/app/expenses',     labelKey: 'expenses.title',     Icon: Receipt,      group: 'tracking',  optional: false },
  { key: 'documents',    to: '/app/documents',    labelKey: 'documents.title',    Icon: FileText,     group: 'resources', optional: false },
  { key: 'photos',       to: '/app/photos',       labelKey: 'photos.title',       Icon: Image,        group: 'resources', optional: true  },
  { key: 'directory',    to: '/app/directory',    labelKey: 'directory.title',    Icon: Users,        group: 'resources', optional: true  },
];

export const OPTIONAL_MODULES = MODULES.filter((m) => m.optional);

/**
 * Household actif de l'utilisateur (fallback : premier de la liste).
 * Partage la query key de useIsHouseholdOwner → un seul fetch.
 */
export function useActiveHousehold(): { household: Household | undefined; isLoading: boolean } {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['households', 'list'],
    queryFn: fetchHouseholds,
    staleTime: 60_000,
  });
  const household =
    (user?.active_household
      ? query.data?.find((h) => h.id === user.active_household)
      : undefined) ?? query.data?.[0];
  return { household, isLoading: query.isLoading };
}

/**
 * Modules désactivés pour le foyer actif. `isLoading` permet aux guards
 * d'attendre la donnée au lieu de rediriger à tort pendant le chargement.
 */
export function useDisabledModules(): { disabled: Set<string>; isLoading: boolean } {
  const { household, isLoading } = useActiveHousehold();
  return { disabled: new Set(household?.disabled_modules ?? []), isLoading };
}

// Même query key que settingsKeys.me() (features/settings/hooks.ts) — cache
// partagé avec la page Réglages, sans dépendance lib → features.
const ME_KEY = ['settings', 'me'] as const;

/** Épinglés de l'utilisateur, persistés sur User.pinned_modules. */
export function usePinnedModules(): string[] {
  const query = useQuery<UserProfile>({
    queryKey: ME_KEY,
    queryFn: fetchMe,
    staleTime: 60_000,
  });
  return query.data?.pinned_modules ?? [];
}

/** Mutation optimiste : la sidebar réagit immédiatement, rollback si erreur. */
export function useSetPinnedModules() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (next: string[]) => patchMe({ pinned_modules: next }),
    onMutate: async (next) => {
      await qc.cancelQueries({ queryKey: ME_KEY });
      const prev = qc.getQueryData<UserProfile>(ME_KEY);
      if (prev) qc.setQueryData(ME_KEY, { ...prev, pinned_modules: next });
      return { prev };
    },
    onError: (_err, _next, ctx) => {
      if (ctx?.prev) qc.setQueryData(ME_KEY, ctx.prev);
    },
    onSettled: () => void qc.invalidateQueries({ queryKey: ME_KEY }),
  });
}
