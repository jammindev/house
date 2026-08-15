import { toLocalISODate } from '@/lib/format';
import type { StockLevelPoint } from '@/lib/api/stock';

/**
 * Ce qui se calcule avant de dessiner la courbe de niveau d'un article.
 *
 * À part du composant parce que c'est ici qu'est le fond — la projection, la
 * jonction du trait plein et du pointillé, le seuil de l'overlay météo — et que
 * rien de tout ça n'a besoin d'un rendu pour être vérifié.
 */

/** Une ligne du graphe : le niveau mesuré, la projection, ou les deux à la jonction. */
export interface CurveRow {
  ts: string;
  level: number | null;
  projection: number | null;
}

/**
 * Clé d'axe stable, insensible au fuseau du navigateur.
 *
 * Le serveur date ses points à minuit dans le fuseau du foyer ; rendus par un
 * navigateur à l'ouest, ils reculeraient d'un jour — c'est la règle
 * `toISOString()` du projet, prise par l'autre bout. Midi local ne bascule
 * jamais, quel que soit le décalage ou l'heure d'été.
 */
export function dayKey(ts: string): string {
  return `${ts.slice(0, 10)}T12:00:00`;
}

function addDays(day: string, offset: number): string {
  const [year, month, date] = day.split('-').map(Number);
  return toLocalISODate(new Date(year, month - 1, date + offset));
}

function daysBetween(from: string, to: string): number {
  const [fy, fm, fd] = from.split('-').map(Number);
  const [ty, tm, td] = to.split('-').map(Number);
  const start = new Date(fy, fm - 1, fd).getTime();
  const end = new Date(ty, tm - 1, td).getTime();
  return Math.round((end - start) / 86_400_000);
}

/**
 * Le pointillé : du dernier relevé jusqu'à zéro, à la date de rupture.
 *
 * Il commence exactement où le trait plein s'arrête — le premier point porte le
 * dernier niveau *connu*, pas une extrapolation — sinon les deux lignes ne se
 * touchent pas et la rupture semble tomber d'ailleurs.
 *
 * **L'horizon est borné par la fenêtre affichée.** Un article lent peut se
 * projeter à dix ans : tracé en entier, il écraserait tout l'historique qu'on
 * était venu lire. Au-delà, le pointillé sort du cadre sans atteindre zéro — la
 * date exacte reste dans sa tuile, qui est faite pour ça.
 */
export function buildProjection(opts: {
  lastTs: string;
  lastQuantity: number;
  depletionDate: string | null;
  horizonDays: number;
}): { ts: string; projection: number }[] {
  const { lastTs, lastQuantity, depletionDate, horizonDays } = opts;
  if (!depletionDate || lastQuantity <= 0) return [];

  const from = lastTs.slice(0, 10);
  const total = daysBetween(from, depletionDate);
  if (total <= 0) return [];

  const drawn = Math.min(total, horizonDays);
  const rows: { ts: string; projection: number }[] = [];
  for (let offset = 0; offset <= drawn; offset += 1) {
    const remaining = lastQuantity * (1 - offset / total);
    rows.push({
      ts: dayKey(addDays(from, offset)),
      projection: Math.round(Math.max(remaining, 0) * 1000) / 1000,
    });
  }
  return rows;
}

/** Fusionne mesuré et projeté sur un axe unique, un point par jour. */
export function buildCurveRows(
  levels: StockLevelPoint[],
  projection: { ts: string; projection: number }[],
): CurveRow[] {
  const rows = new Map<string, CurveRow>();
  for (const point of levels) {
    const ts = dayKey(point.ts);
    rows.set(ts, { ts, level: point.quantity, projection: null });
  }
  for (const point of projection) {
    const existing = rows.get(point.ts);
    if (existing) existing.projection = point.projection;
    else rows.set(point.ts, { ts: point.ts, level: null, projection: point.projection });
  }
  return [...rows.values()].sort((a, b) => a.ts.localeCompare(b.ts));
}

/**
 * En dessous de quatre relevés dans la fenêtre, pas d'overlay météo.
 *
 * La pente est **constante par construction** entre deux comptages : superposer
 * une température qui varie chaque jour à une droite qui ne peut pas varier
 * invite l'œil à conclure de rien. Quatre relevés donnent trois pentes qui
 * peuvent différer — le minimum pour qu'une corrélation ait de quoi s'écrire.
 *
 * C'est la même règle que `capabilities` : on ne propose pas un bouton dont la
 * donnée ne peut pas tenir la promesse.
 */
export const MIN_READINGS_FOR_WEATHER = 4;

export function canOverlayWeather(readingCount: number): boolean {
  return readingCount >= MIN_READINGS_FOR_WEATHER;
}
