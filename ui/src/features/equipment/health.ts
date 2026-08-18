/**
 * Rendre un verdict de santé — **une seule fois pour toute la feature**.
 *
 * Le défaut d'origine : la fiche écrivait « Garantie : Expirée » en rouge
 * pendant que la liste affichait la même date en gris, au milieu des autres.
 * Les deux écrans savaient la même chose et n'en disaient pas la même chose ;
 * c'est le lecteur qui arbitrait, et une liste qui ne signale rien apprend à ne
 * plus être lue.
 *
 * Le verdict lui-même (`state`) vient du serveur — ici on ne décide rien, on
 * choisit un ton et une phrase. Ne jamais recalculer un état à partir d'une
 * date : dans un navigateur, « aujourd'hui » est le jour de la machine, pas
 * celui du foyer.
 */
import { formatRelativeDays } from '@/lib/format';
import {
  EQUIPMENT_CATEGORIES,
  EQUIPMENT_CONDITIONS,
  type EquipmentCategory,
  type EquipmentCondition,
  type MaintenanceStateKey,
  type WarrantyStateKey,
} from '@/lib/api/equipment';

/** Le ton d'un verdict — mappé sur les tokens du design-system, jamais une couleur. */
export type HealthTone = 'danger' | 'warning' | 'neutral' | 'muted';

export const TONE_CLASS: Record<HealthTone, string> = {
  danger: 'text-destructive',
  warning: 'text-amber-600 dark:text-amber-500',
  neutral: 'text-foreground',
  muted: 'text-muted-foreground',
};

const WARRANTY_TONES: Record<WarrantyStateKey, HealthTone> = {
  expired: 'danger',
  expiring: 'warning',
  valid: 'muted',
  unknown: 'muted',
};

const MAINTENANCE_TONES: Record<MaintenanceStateKey, HealthTone> = {
  overdue: 'danger',
  due_soon: 'warning',
  ok: 'muted',
  unknown: 'muted',
};

export function warrantyTone(state: WarrantyStateKey): HealthTone {
  return WARRANTY_TONES[state] ?? 'muted';
}

export function maintenanceTone(state: MaintenanceStateKey): HealthTone {
  return MAINTENANCE_TONES[state] ?? 'muted';
}

/**
 * Un verdict mérite-t-il d'apparaître sur une carte de liste ?
 *
 * « Sous garantie encore trois ans » et « pas de garantie connue » sont vrais et
 * sans intérêt : les afficher sur chaque ligne noierait les deux qui comptent.
 * La fiche, elle, les montre — c'est là qu'on va chercher le détail.
 */
export function isNoteworthy(state: WarrantyStateKey | MaintenanceStateKey): boolean {
  return state === 'expired' || state === 'expiring' || state === 'overdue' || state === 'due_soon';
}

/**
 * La valeur de catégorie à afficher — **jamais** celle qui sort de la base.
 *
 * Une clé construite sur une valeur hors vocabulaire n'affiche pas un défaut :
 * elle affiche la clé elle-même, `equipment.category.` suivi de la valeur, en
 * toutes lettres dans la liste. Constaté en vrai avec `hvac` — une base semée
 * par du code antérieur à la migration 0006 suffit, et un import, une écriture
 * directe ou une instance tierce en retard d'une version feront pareil.
 *
 * C'est la limite connue des clés construites (cf. `keys.test.ts` : « pour une
 * énumération, le catalogue doit couvrir toutes ses valeurs ») — sauf qu'ici on
 * ne contrôle pas ce que la base contient, seulement ce qu'on en fait. Donc :
 * l'inconnu retombe sur `other`, comme `services.normalize_category` côté
 * serveur. Une valeur qu'on ne sait pas nommer se range dans « Autre », elle ne
 * s'affiche pas en jargon.
 */
export function categoryKey(category: string | null | undefined): EquipmentCategory {
  return (EQUIPMENT_CATEGORIES as readonly string[]).includes(category ?? '')
    ? (category as EquipmentCategory)
    : 'other';
}

/** Même garde pour l'état d'usure, pour la même raison. */
export function conditionKey(condition: string | null | undefined): EquipmentCondition {
  return (EQUIPMENT_CONDITIONS as readonly string[]).includes(condition ?? '')
    ? (condition as EquipmentCondition)
    : 'good';
}

/**
 * Le « quand » d'un verdict, dans l'unité qui se lit.
 *
 * Le serveur renvoie un écart en jours signé (négatif = dépassé) ; le rendu
 * passe par `formatRelativeDays`, donc « il y a 6 ans » plutôt que « depuis
 * 2136 jours » — ce qu'il fallait poser et diviser pour comprendre.
 */
export function healthWhen(days: number | null): string {
  return formatRelativeDays(days ?? 0);
}
