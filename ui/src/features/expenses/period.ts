import { toLocalISODate } from '@/lib/format';

export type PeriodPreset = 'currentMonth' | 'previousMonth' | 'last30Days' | 'currentYear' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  from?: string; // ISO date YYYY-MM-DD
  to?: string;   // ISO date YYYY-MM-DD (inclusive)
}

/**
 * Les bornes d'une période, en dates de calendrier.
 *
 * Elles passent par `toLocalISODate` et **jamais** par `toISOString()`, qui
 * convertit en UTC avant de formater : à Paris, minuit local du 1er juillet
 * devient `2026-06-30T22:00Z`, donc « 2026-06-30 » une fois tronqué. Toutes les
 * périodes partaient décalées d'un jour aux deux bouts — « ce mois-ci » allait
 * du 30 juin au 30 juillet, « cette année » commençait le 31 décembre précédent.
 * Le 31 disparaissait des totaux pendant que le 30 du mois d'avant s'y invitait.
 *
 * Le serveur ancre ensuite ces dates dans le fuseau du foyer
 * (`core.timezones`), ce qui referme la boucle : même mois des deux côtés.
 */
export function resolvePeriod(range: PeriodRange): { from?: string; to?: string } {
  const now = new Date();
  if (range.preset === 'currentMonth') {
    const from = new Date(now.getFullYear(), now.getMonth(), 1);
    const to = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { from: toLocalISODate(from), to: toLocalISODate(to) };
  }
  if (range.preset === 'previousMonth') {
    const from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
    const to = new Date(now.getFullYear(), now.getMonth(), 0);
    return { from: toLocalISODate(from), to: toLocalISODate(to) };
  }
  if (range.preset === 'last30Days') {
    const to = now;
    const from = new Date(now);
    from.setDate(from.getDate() - 30);
    return { from: toLocalISODate(from), to: toLocalISODate(to) };
  }
  if (range.preset === 'currentYear') {
    const from = new Date(now.getFullYear(), 0, 1);
    const to = new Date(now.getFullYear(), 11, 31);
    return { from: toLocalISODate(from), to: toLocalISODate(to) };
  }
  return { from: range.from, to: range.to };
}
