import type { DocumentItem } from '@/lib/api/documents';

export interface MonthGroup {
  /** Clé stable `YYYY-MM`, construite sur les composantes **locales** de la date. */
  key: string;
  /** Une date du mois, à donner au formateur pour l'en-tête. */
  anchor: string;
  photos: DocumentItem[];
}

/**
 * La date qui situe une photo dans le temps : celle de la **prise de vue** quand on
 * la connaît, celle de l'ajout sinon.
 *
 * C'est le pendant client de l'annotation `effective_date` du serveur
 * (`COALESCE(taken_at, created_at)`), et les deux doivent rester d'accord : le tri
 * vient du serveur, les en-têtes de mois d'ici. S'ils divergeaient, une photo
 * apparaîtrait sous un en-tête « juillet » entre deux photos de juin — la liste
 * semblerait mal triée alors que c'est l'étiquette qui mentirait.
 *
 * `taken_at` vaut `null` pour une capture d'écran, un scan, ou une photo dont l'EXIF
 * a été strippé. Le repli est ici, à la lecture, et jamais en base.
 */
export function effectiveDate(photo: DocumentItem): string {
  return photo.taken_at || photo.created_at;
}

/** true si la date affichée est celle du déclenchement, et non celle de l'import. */
export function hasCaptureDate(photo: DocumentItem): boolean {
  return Boolean(photo.taken_at);
}

/**
 * Regroupe des photos par mois, en préservant l'ordre reçu (l'API renvoie
 * `-effective_date`, donc du plus récent au plus ancien).
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
    const anchor = effectiveDate(photo);
    const date = new Date(anchor);
    const key = Number.isNaN(date.getTime())
      ? 'unknown'
      : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;

    let group = index.get(key);
    if (!group) {
      group = { key, anchor, photos: [] };
      index.set(key, group);
      groups.push(group);
    }
    group.photos.push(photo);
  }

  return groups;
}
