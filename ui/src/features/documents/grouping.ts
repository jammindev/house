import { DOCUMENT_TYPES, type DocumentItem } from '@/lib/api/documents';

/** Axe de regroupement de la liste des documents. */
export type GroupMode = 'type' | 'date';

export interface DocumentGroup {
  /** Clé stable — un type de document, ou `YYYY-MM` en mode date. */
  key: string;
  /**
   * De quoi étiqueter l'en-tête : un type à traduire (`documents.type.<key>`), ou
   * une date du mois à passer au formateur. L'un des deux est toujours nul — c'est
   * le mode qui décide, et l'appelant n'a pas à le redeviner.
   */
  type: string | null;
  anchor: string | null;
  documents: DocumentItem[];
}

/**
 * `true` si le document n'est rattaché à aucune activité **ni** à un contexte
 * secondaire (zone, projet).
 *
 * Une seule définition, partagée par la pastille de filtre de la liste et le badge
 * de la carte (`DocumentCard`). Les deux disaient la même chose avec deux
 * expressions différentes, et « 12 sans contexte » face à onze badges sur l'écran
 * fait perdre son crédit aux deux compteurs.
 */
export function isWithoutContext(doc: DocumentItem): boolean {
  return (
    doc.qualification.qualification_state === 'without_activity' &&
    !doc.qualification.has_secondary_context
  );
}

/**
 * Nombre de documents par type, plus `''` pour le total.
 *
 * Compté sur la liste **déjà filtrée par la recherche** : un compteur qui
 * annoncerait 18 factures alors que la recherche courante n'en montre que 2 dirait
 * juste le contraire de ce que le clic va produire.
 */
export function countByType(documents: DocumentItem[]): Record<string, number> {
  const counts: Record<string, number> = { '': documents.length };
  for (const doc of documents) {
    const key = doc.type || 'document';
    counts[key] = (counts[key] ?? 0) + 1;
  }
  return counts;
}

/**
 * Ordre des sections en mode « type » : celui du catalogue `DOCUMENT_TYPES`, et non
 * le volume décroissant.
 *
 * Un ordre qui suit les compteurs se réorganise sous les yeux à chaque import : la
 * section qu'on vise n'est jamais deux fois à la même place, et la mémoire de la
 * position — la seule chose qui rend une longue liste navigable — ne se construit
 * pas. Les types hors catalogue (donnée ancienne, valeur retirée depuis) ferment la
 * marche plutôt que de disparaître.
 */
function typeRank(type: string): number {
  const index = (DOCUMENT_TYPES as readonly string[]).indexOf(type);
  return index === -1 ? DOCUMENT_TYPES.length : index;
}

/**
 * Regroupe les documents selon `mode`, en préservant l'ordre reçu à l'intérieur de
 * chaque groupe (l'API renvoie `-created_at`, donc du plus récent au plus ancien).
 *
 * En mode date, la clé est bâtie sur `getFullYear()` / `getMonth()` et **jamais** sur
 * `toISOString().slice(0, 7)` : à Paris, un document ajouté le 1er juillet à 00 h 30
 * est en juin en UTC — il atterrirait sous le mauvais en-tête, et la coupure entre
 * deux mois se ferait au mauvais endroit (même raison que `toLocalISODate`).
 */
export function groupDocuments(documents: DocumentItem[], mode: GroupMode): DocumentGroup[] {
  const groups: DocumentGroup[] = [];
  const index = new Map<string, DocumentGroup>();

  for (const doc of documents) {
    let key: string;
    if (mode === 'type') {
      key = doc.type || 'document';
    } else {
      const date = new Date(doc.created_at);
      key = Number.isNaN(date.getTime())
        ? 'unknown'
        : `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
    }

    let group = index.get(key);
    if (!group) {
      group = {
        key,
        type: mode === 'type' ? key : null,
        anchor: mode === 'date' ? doc.created_at : null,
        documents: [],
      };
      index.set(key, group);
      groups.push(group);
    }
    group.documents.push(doc);
  }

  // En mode date l'ordre reçu est déjà le bon (l'API trie par `-created_at`) ; en
  // mode type il n'a aucune raison de l'être, c'est le catalogue qui l'ordonne.
  if (mode === 'type') {
    groups.sort((a, b) => typeRank(a.key) - typeRank(b.key));
  }

  return groups;
}
