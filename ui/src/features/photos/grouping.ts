import type { DocumentItem } from '@/lib/api/documents';

export interface MonthGroup {
  /** Clé stable `YYYY-MM`, construite sur les composantes **locales** de la date. */
  key: string;
  /** Une date du mois, à donner au formateur pour l'en-tête. */
  anchor: string;
  photos: DocumentItem[];
}

/**
 * Regroupe des photos par mois de création, en préservant l'ordre reçu (l'API
 * renvoie `-created_at`, donc du plus récent au plus ancien).
 *
 * La clé est bâtie sur `getFullYear()` / `getMonth()`, **jamais** sur
 * `toISOString().slice(0, 7)` : à Paris, une photo prise le 1er juillet à 00 h 30
 * est en juin en UTC — elle atterrirait sous le mauvais en-tête, et la coupure
 * entre deux mois se ferait au mauvais endroit (même raison que `toLocalISODate`).
 */
export function groupPhotosByMonth(photos: DocumentItem[]): MonthGroup[] {
  const groups: MonthGroup[] = [];
  const index = new Map<string, MonthGroup>();

  for (const photo of photos) {
    const date = new Date(photo.created_at);
    const key = Number.isNaN(date.getTime())
      ? 'unknown'
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let group = index.get(key);
    if (!group) {
      group = { key, anchor: photo.created_at, photos: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.photos.push(photo);
  }

  return groups;
}
