import { Eye, Heart, Wrench, type LucideIcon } from 'lucide-react';
import type { PhotoPurpose } from '@/lib/api/documents';

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
