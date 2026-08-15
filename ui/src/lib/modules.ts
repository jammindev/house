import {
  Bird, Box, CloudSun, Compass, Droplets, FileText, FolderKanban, Image, Landmark, ListTodo, MapPin,
  Notebook, PiggyBank, Receipt, ShoppingCart, TreeDeciduous, TrendingUp, Umbrella, Users,
  Wrench, Zap,
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

export type ModuleGroup = 'home' | 'tracking' | 'money' | 'resources';

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
  // « Argent » est un groupe, pas un module : son libellé est celui que portait
  // l'entrée unique (`money.title`), qui reste ainsi défini une seule fois.
  { key: 'money', labelKey: 'money.title' },
  { key: 'resources', labelKey: 'sidebar.groupResources' },
];

export const MODULES: ModuleDef[] = [
  { key: 'zones',        to: '/app/zones',        labelKey: 'zones.title',        Icon: MapPin,       group: 'home',      optional: false },
  { key: 'equipment',    to: '/app/equipment',    labelKey: 'equipment.title',    Icon: Wrench,       group: 'home',      optional: false },
  { key: 'electricity',  to: '/app/electricity',  labelKey: 'electricity.title',  Icon: Zap,          group: 'home',      optional: true  },
  { key: 'water',        to: '/app/water',        labelKey: 'water.title',        Icon: Droplets,     group: 'home',      optional: true  },
  { key: 'weather',      to: '/app/weather',      labelKey: 'weather.title',      Icon: CloudSun,     group: 'home',      optional: true  },
  { key: 'stock',        to: '/app/stock',        labelKey: 'stock.title',        Icon: Box,          group: 'home',      optional: true  },
  { key: 'chickens',     to: '/app/chickens',     labelKey: 'chickens.title',     Icon: Bird,         group: 'home',      optional: true  },
  { key: 'orchard',      to: '/app/orchard',      labelKey: 'orchard.title',      Icon: TreeDeciduous, group: 'home',     optional: true  },
  { key: 'games',        to: '/app/games',        labelKey: 'games.title',        Icon: Compass,      group: 'home',      optional: true  },
  { key: 'insurance',    to: '/app/insurance',    labelKey: 'insurance.title',    Icon: Umbrella,     group: 'home',      optional: true  },
  { key: 'tasks',        to: '/app/tasks',        labelKey: 'tasks.title',        Icon: ListTodo,     group: 'tracking',  optional: false },
  { key: 'projects',     to: '/app/projects',     labelKey: 'projects.title',     Icon: FolderKanban, group: 'tracking',  optional: false },
  { key: 'interactions', to: '/app/interactions', labelKey: 'interactions.title', Icon: Notebook,     group: 'tracking',  optional: false },
  { key: 'shopping',     to: '/app/shopping-list', labelKey: 'shoppingList.title', Icon: ShoppingCart, group: 'tracking',  optional: true  },
  { key: 'trackers',     to: '/app/trackers',     labelKey: 'trackers.title',     Icon: TrendingUp,   group: 'tracking',  optional: true  },
  // « Argent » est un **groupe** de trois pages, plus une entrée à cinq onglets
  // (parcours 26, lot 2 → issue #562). Chaque lecture retrouve une URL propre —
  // `/app/money/budgets`, `/app/money/expenses`, `/app/money/accounts` — et
  // l'entrée de nav dit enfin ce qu'on va y trouver. Contrôle et « À ranger »
  // restent des onglets de la page Comptes : ce sont deux façons de regarder ce
  // qui manque aux relevés, pas deux destinations.
  //
  // Les trois clés restent `optional: false` — dépenses et budgets n'ont jamais
  // été désactivables, et les comptes ont cessé de l'être à la fusion.
  { key: 'money_budgets',  to: '/app/money/budgets',  labelKey: 'budget.title',   Icon: PiggyBank, group: 'money', optional: false },
  { key: 'money_expenses', to: '/app/money/expenses', labelKey: 'expenses.title', Icon: Receipt,   group: 'money', optional: false },
  { key: 'money_accounts', to: '/app/money/accounts', labelKey: 'banking.title',  Icon: Landmark,  group: 'money', optional: false },
  { key: 'documents',    to: '/app/documents',    labelKey: 'documents.title',    Icon: FileText,     group: 'resources', optional: false },
  { key: 'photos',       to: '/app/photos',       labelKey: 'photos.title',       Icon: Image,        group: 'resources', optional: true  },
  { key: 'directory',    to: '/app/directory',    labelKey: 'directory.title',    Icon: Users,        group: 'resources', optional: true  },
];

export const OPTIONAL_MODULES = MODULES.filter((m) => m.optional);

/**
 * Les foyers de l'utilisateur, et lequel est actif (fallback : le premier).
 *
 * Une seule définition de « quel foyer suis-je en train de lire » : la règle
 * était recopiée dans trois hooks, et un titre de header qui désigne un autre
 * foyer que la sidebar est un mensonge qu'on ne voit qu'en production.
 */
export function useHouseholdList(): {
  households: Household[];
  active: Household | undefined;
  isLoading: boolean;
} {
  const { user } = useAuth();
  const query = useQuery({
    queryKey: ['households', 'list'],
    queryFn: fetchHouseholds,
    staleTime: 60_000,
  });
  const households = query.data ?? [];
  const active =
    (user?.active_household
      ? households.find((h) => h.id === user.active_household)
      : undefined) ?? households[0];
  return { households, active, isLoading: query.isLoading };
}

/** Household actif de l'utilisateur (fallback : premier de la liste). */
export function useActiveHousehold(): { household: Household | undefined; isLoading: boolean } {
  const { active, isLoading } = useHouseholdList();
  return { household: active, isLoading };
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
