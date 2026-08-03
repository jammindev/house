import { useQuery } from '@tanstack/react-query';

import { fetchCapabilities, type Capability } from '@/lib/api/capabilities';

/**
 * Ce que l'instance sait faire — lu avant d'afficher une promesse.
 *
 * Une capacité absente (pas de clé Anthropic, pas de SMTP, pas de VAPID) ne
 * casse rien côté serveur : l'assistant répond « je ne sais pas », la jambe
 * sémantique renvoie `[]`, l'e-mail part dans les logs. Le défaut est ailleurs —
 * **l'interface promet quand même**, et l'utilisateur en conclut que le produit
 * est mauvais plutôt qu'il lui manque une clé.
 *
 * Ce hook est la contrepartie front du registre `app_settings.capabilities` :
 * il ne relit jamais un réglage, il lit le verdict du serveur. Ajouter une
 * capacité = une entrée dans le registre + les clés `capabilities.<key>.*` dans
 * les quatre catalogues, aucune modification d'écran.
 *
 * Ce n'est pas une donnée de foyer : les clés se posent par instance (le `.env`
 * **est** le BYOK de l'auto-hébergeur), donc rien ici n'entre dans le graphe
 * d'invalidation de `lib/invalidate.ts` — aucune écriture de l'app ne peut la
 * changer.
 */

export const capabilityKeys = {
  all: ['capabilities'] as const,
};

/**
 * `staleTime` long, mais **pas** `Infinity` : ajouter une clé et redémarrer le
 * conteneur ne recharge pas l'onglet ouvert du foyer. Trente minutes bornent
 * l'attente sans transformer chaque montage d'écran gaté en requête.
 */
const CAPABILITIES_STALE_TIME = 30 * 60 * 1000;

export function useCapabilities() {
  return useQuery({
    queryKey: capabilityKeys.all,
    queryFn: fetchCapabilities,
    staleTime: CAPABILITIES_STALE_TIME,
  });
}

/**
 * L'état d'**une** capacité.
 *
 * `available` reste `false` tant que la liste n'est pas chargée, et
 * `isLoading` dit pourquoi. Les confondre afficherait « nécessite une clé »
 * pendant le chargement, à un foyer qui en a une — la version écran du compteur
 * à zéro qui a deux sens.
 */
export function useCapability(key: string): {
  available: boolean;
  isLoading: boolean;
  capability: Capability | undefined;
} {
  const { data, isLoading } = useCapabilities();
  const capability = data?.find((c) => c.key === key);
  return { available: Boolean(capability?.available), isLoading, capability };
}
