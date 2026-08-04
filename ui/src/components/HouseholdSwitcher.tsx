import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { Check, ChevronDown } from 'lucide-react';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/design-system/dropdown-menu';
import { api } from '@/lib/axios';
import { useHouseholdList } from '@/lib/modules';

/**
 * Le nom du foyer actif, en titre du header — et le sélecteur quand il y en a
 * plusieurs.
 *
 * Le nom de l'app n'apprenait rien : l'utilisateur sait quelle app il ouvre,
 * pas toujours quel foyer il lit. Un foyer unique n'a donc pas de chevron : un
 * menu à une entrée est une promesse de choix qui n'existe pas.
 *
 * La liste vient de `useHouseholdList` (clé `['households', 'list']`) : ce
 * composant maintenait sa propre requête sur une clé à lui, si bien que le
 * header pouvait nommer un foyer et le reste de l'app en lire un autre.
 */
export default function HouseholdSwitcher() {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const { households, active } = useHouseholdList();

  const switchHousehold = useMutation({
    mutationFn: (householdId: string) =>
      api.post('/households/switch/', { household_id: householdId }),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });

  if (!active) return null;

  if (households.length <= 1) {
    return (
      <span
        data-testid="topbar-household"
        className="truncate text-sm font-semibold text-foreground"
      >
        {active.name}
      </span>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          data-testid="topbar-household"
          aria-label={t('settings.switchHousehold')}
          className="flex min-w-0 items-center gap-1 rounded-md px-1 py-0.5 text-sm font-semibold text-foreground transition-colors hover:bg-accent"
        >
          <span className="truncate">{active.name}</span>
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" aria-hidden />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        {households.map((household) => (
          <DropdownMenuItem
            key={household.id}
            disabled={switchHousehold.isPending}
            onSelect={() => {
              if (household.id !== active.id) switchHousehold.mutate(household.id);
            }}
            className="gap-2"
          >
            <Check
              className={`h-4 w-4 shrink-0 ${household.id === active.id ? 'opacity-100' : 'opacity-0'}`}
              aria-hidden
            />
            <span className="truncate">{household.name}</span>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
