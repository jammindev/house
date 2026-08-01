import { toLocalISODate } from '@/lib/format';

export type PeriodPreset = 'month' | 'last30Days' | 'currentYear' | 'custom';

export interface PeriodRange {
  preset: PeriodPreset;
  /** Pour `month` uniquement : le mois visé, `YYYY-MM`. */
  month?: string;
  from?: string; // ISO date YYYY-MM-DD
  to?: string;   // ISO date YYYY-MM-DD (inclusive)
}

/** Le mois en cours **dans le fuseau du lecteur**, `YYYY-MM`. */
export function currentMonthKey(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

/**
 * `YYYY-MM` décalé de `delta` mois — le pas du sélecteur.
 *
 * Le calcul porte sur le couple (année, mois) et **jamais** sur une date du
 * calendrier : un `setMonth(+1)` appliqué au 31 janvier donne le 3 mars, parce
 * que février n'a pas de 31. Les flèches sauteraient un mois sur deux selon le
 * jour où l'on clique.
 */
export function shiftMonth(month: string, delta: number): string {
  const [year, index] = month.split('-').map(Number);
  const total = year * 12 + (index - 1) + delta;
  return `${Math.floor(total / 12)}-${String((total % 12) + 1).padStart(2, '0')}`;
}

/** Les bornes locales d'un `YYYY-MM`, du 1er au dernier jour inclus. */
function monthBounds(month: string): { from: string; to: string } {
  const [year, index] = month.split('-').map(Number);
  // `new Date(y, m, 0)` = dernier jour du mois `m` — 28, 29, 30 ou 31 sans
  // table des longueurs, année bissextile comprise.
  return {
    from: toLocalISODate(new Date(year, index - 1, 1)),
    to: toLocalISODate(new Date(year, index, 0)),
  };
}

const KNOWN_PRESETS: PeriodPreset[] = ['month', 'last30Days', 'currentYear', 'custom'];

/**
 * Rend utilisable un état de période venu d'ailleurs — sessionStorage écrit par
 * une version antérieure, ou valeur corrompue.
 *
 * Les presets `currentMonth` / `previousMonth` ont été remplacés par la
 * navigation `month`, et un état persisté leur survit : `useSessionState` relit
 * ce qui a été écrit avant le déploiement. Sans cette conversion, l'ancien
 * `{preset: 'currentMonth'}` tombe dans la branche `custom` de `resolvePeriod`,
 * qui renvoie deux bornes `undefined` — la page interroge alors **tout
 * l'historique du foyer** en annonçant « ce mois-ci ». Le défaut ne se voit que
 * chez ceux qui utilisaient déjà l'écran, jamais chez celui qui l'écrit.
 */
export function normalizePeriod(range: PeriodRange): PeriodRange {
  const preset = range?.preset as string | undefined;
  if (preset === 'previousMonth') {
    return { preset: 'month', month: shiftMonth(currentMonthKey(), -1) };
  }
  if (preset === 'month' && range.month) return range;
  if (preset && preset !== 'month' && KNOWN_PRESETS.includes(preset as PeriodPreset)) {
    return range;
  }
  // `currentMonth`, `month` sans mois, et tout le reste : le mois en cours.
  return { preset: 'month', month: currentMonthKey() };
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
  if (range.preset === 'month') {
    return monthBounds(range.month || currentMonthKey());
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
