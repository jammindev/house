import { api } from '@/lib/axios';

/**
 * Une capacité optionnelle de l'instance — ce que ce serveur sait faire selon
 * les clés dont il dispose. Voir `apps/app_settings/capabilities.py`.
 */
export interface Capability {
  /** Identifiant stable ; sert aussi de clé i18n (`capabilities.<key>.*`). */
  key: string;
  available: boolean;
  /** Variables d'environnement qui portent la capacité, dans l'ordre à poser. */
  env_vars: string[];
  /** Section de `docs/self-hosting/ai-providers.md` qui explique comment l'activer. */
  docs_url: string;
}

export async function fetchCapabilities(): Promise<Capability[]> {
  const { data } = await api.get<{ capabilities: Capability[] }>('/capabilities/');
  return data.capabilities;
}
