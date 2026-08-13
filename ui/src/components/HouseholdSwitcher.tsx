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
import { useIsMobile } from '@/lib/hooks/useIsMobile';
import { useHouseholdList } from '@/lib/modules';

/** Où le nom du foyer est posé dans la coquille de l'app. */
export type HouseholdSwitcherPlacement = 'topbar' | 'sidebar';

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
 *
 * **Il n'a qu'un domicile à la fois** (#577) : le header sur écran large, la
 * sidebar sous 768 px. Le header mobile porte déjà cinq actions à droite —
 * météo, recherche, cloche, avatar, déconnexion — et un `flex-1` de plus les
 * rognait ; le logo et le nom d'utilisateur y sont d'ailleurs déjà masqués
 * pour la même raison. La bascule se fait en JS, pas en CSS : deux instances
 * masquées l'une après l'autre laisseraient deux `data-testid` identiques dans
 * le DOM, et un sélecteur strict n'aurait plus de réponse unique à « où est le
 * nom du foyer ». C'est aussi pourquoi le testid ne change pas avec
 * l'emplacement : il désigne le nom du foyer, où qu'il soit.
 */
export default function HouseholdSwitcher({ placement }: { placement: HouseholdSwitcherPlacement }) {
  const { t } = useTranslation();
  const qc = useQueryClient();
  const isMobile = useIsMobile();
  const { households, active } = useHouseholdList();

  const switchHousehold = useMutation({
    mutationFn: (householdId: string) =>
      api.post('/households/switch/', { household_id: householdId }),
    onSuccess: () => {
      void qc.invalidateQueries();
    },
  });

  if (placement !== (isMobile ? 'sidebar' : 'topbar')) return null;
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
