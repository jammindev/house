import { Eye, Heart, Wrench, type LucideIcon } from 'lucide-react';
import { UNTRIAGED, type PhotoPurpose } from '@/lib/api/documents';

/**
 * Les trois intentions, dans l'ordre où l'écran les propose — **une seule
 * définition**, lue par les pastilles de la galerie, le panneau de tri et la
 * lightbox. Trois listes séparées auraient dérivé à la première intention ajoutée,
 * et un même mot serait apparu sous deux icônes.
 *
 * ⚠️ « À trier » n'est **pas** une quatrième intention : c'est l'absence de choix, et
 * elle vit à part (`UNTRIAGED`) précisément pour qu'on ne puisse pas la ranger dans
 * cette liste par commodité. Le vide n'est pas un souvenir.
 */
export interface PurposeSpec {
  key: PhotoPurpose;
  icon: LucideIcon;
  /** Clé i18n du libellé — vérifiée par la couverture des quatre catalogues. */
  labelKey: string;
  /** Clé i18n de la phrase qui dit à quoi sert cette intention. */
  hintKey: string;
}

export const PURPOSES: readonly PurposeSpec[] = [
  {
    key: 'technical',
    icon: Wrench,
    labelKey: 'photos.purpose.technical',
    hintKey: 'photos.purpose.technicalHint',
  },
  {
    key: 'observation',
    icon: Eye,
    labelKey: 'photos.purpose.observation',
    hintKey: 'photos.purpose.observationHint',
  },
  {
    key: 'memory',
    icon: Heart,
    labelKey: 'photos.purpose.memory',
    hintKey: 'photos.purpose.memoryHint',
  },
];

export function purposeSpec(purpose: string | null | undefined): PurposeSpec | undefined {
  return PURPOSES.find((spec) => spec.key === purpose);
}

/**
 * Ce que la galerie montre quand personne n'a rien demandé.
 *
 * Elle **ne s'ouvre pas sur l'ensemble** : la photothèque d'un foyer mélange le
 * numéro de série d'une chaudière et un anniversaire, et l'ouvrir en vrac ne
 * répond à aucune des deux questions qu'on vient y poser. Les souvenirs sont ce
 * qu'on regarde, le reste est ce qu'on consulte — et se retrouve d'une pastille.
 */
export const DEFAULT_PURPOSES: readonly PhotoPurpose[] = ['memory'];

/** L'ordre de l'écran, pour qu'une même sélection s'écrive toujours pareil. */
const ORDER = PURPOSES.map((spec) => spec.key);

/**
 * La sélection après un clic sur `key` — `''` étant la pastille « Toutes ».
 *
 * Deux invariants, et ils sont la raison d'être de cette fonction plutôt que d'un
 * `setState` au point d'appel :
 *
 * - **« À trier » reste seule.** Ce n'est pas une quatrième intention mais l'absence
 *   de choix, et elle ouvre un autre écran — la file par grappes. La mêler à des
 *   intentions donnerait une réponse inclassable, ni galerie ni file (le serveur la
 *   refuse d'ailleurs en 400).
 * - **Tout décocher revient à « Toutes »**, jamais à une galerie vide. Une liste
 *   vide sans rien à décocher est un cul-de-sac : l'écran ne dirait ni pourquoi il
 *   est vide, ni comment en sortir.
 */
export function togglePurpose(selection: readonly string[], key: string): string[] {
  if (key === '') return [];
  if (key === UNTRIAGED) return selection.length === 1 && selection[0] === UNTRIAGED ? [] : [UNTRIAGED];

  const withoutTriage = selection.filter((value) => value !== UNTRIAGED);
  const next = withoutTriage.includes(key)
    ? withoutTriage.filter((value) => value !== key)
    : [...withoutTriage, key];

  return ORDER.filter((value) => next.includes(value));
}

/**
 * Ce qui part dans `?purpose=` — `undefined` pour « toutes ».
 *
 * On **omet** la clé plutôt que d'envoyer un vide : le serveur refuse `?purpose=`,
 * précisément pour qu'un paramètre oublié ne puisse jamais se lire comme un filtre.
 */
export function purposeParam(selection: readonly string[]): string | undefined {
  return selection.length > 0 ? selection.join(',') : undefined;
}

/**
 * La sélection décrite par un `?purpose=` d'URL, ou `null` s'il n'y en a pas.
 *
 * C'est ce qui fait qu'une notification **mène** : « Ben a ajouté des photos »
 * ouvre l'étagère où elles sont, et pas la galerie par défaut où elles ne sont
 * justement pas. Une valeur inconnue est ignorée plutôt que d'afficher une erreur —
 * un lien vieilli doit retomber sur un écran normal.
 */
export function purposesFromParam(raw: string | null | undefined): string[] | null {
  if (!raw) return null;
  const requested = raw.split(',').map((value) => value.trim());
  if (requested.length === 1 && requested[0] === UNTRIAGED) return [UNTRIAGED];

  const known = ORDER.filter((value) => requested.includes(value));
  return known.length > 0 ? known : null;
}
