import { AlertTriangle, Brush, Clock, CloudSun, Egg, Package, Wrench, type LucideIcon } from 'lucide-react';
import type {
  AlertSeverity,
  AlertsSummary,
  DueChoreAlert,
  WeatherAlert,
} from '@/lib/api/alerts';

/** Une alerte prête à afficher, quelle que soit sa famille d'origine. */
export interface AlertRow {
  key: string;
  to: string;
  title: string;
  meta: string;
  severity: AlertSeverity;
}

export interface AlertSection {
  key: string;
  titleKey: string;
  Icon: LucideIcon;
  iconClass: string;
  rows: AlertRow[];
}

type Translate = (key: string, options?: Record<string, unknown>) => string;

export const EMPTY_ALERTS_SUMMARY: AlertsSummary = {
  overdue_tasks: [],
  expiring_warranties: [],
  due_maintenances: [],
  low_stock: [],
  weather_alerts: [],
  egg_drop_alerts: [],
  due_chores: [],
  total: 0,
  // `false` et non `true` : ce littéral sert de repli quand on ne sait pas
  // encore. L'inconnu ne doit pas se lire comme « ce foyer est vide », sinon un
  // foyer bien rempli verrait clignoter l'écran des premiers pas le temps du
  // chargement. Même défaut sûr que `guess_internal`, qui renvoie `False` sur
  // l'inconnu plutôt que de deviner.
  household_is_empty: false,
};

function weatherTitle(t: Translate, item: WeatherAlert): string {
  return item.value !== null
    ? t(`alerts.weather.${item.kind}`, { value: item.value })
    : t(`alerts.weather.${item.kind}`);
}

/** Trois états distincts, et le troisième n'est pas « en retard de 0 jour ». */
function choreMeta(t: Translate, item: DueChoreAlert): string {
  if (item.never_done) return t('alerts.choreNeverDone', { count: item.interval_days });
  if (item.days_overdue === 0) return t('alerts.choreDueToday');
  return t('alerts.choreOverdue', { count: item.days_overdue, date: item.next_due_on });
}

/**
 * Le texte d'une alerte, en un seul endroit.
 *
 * La page `/app/alerts` et la section « Alertes » de la cloche du header lisent
 * ce même builder : deux formulations divergentes du même fait feraient perdre
 * leur crédit aux deux, et celle qu'on lit ne serait jamais celle qu'on corrige.
 * Les sections vides ne sont pas renvoyées.
 */
export function buildAlertSections(
  summary: AlertsSummary,
  t: Translate,
  locale: string,
): AlertSection[] {
  const sections: AlertSection[] = [
    {
      key: 'overdue',
      titleKey: 'alerts.sections.overdue',
      Icon: Clock,
      iconClass: 'text-destructive',
      rows: summary.overdue_tasks.map((item) => ({
        key: `task-${item.id}`,
        to: item.entity_url,
        title: item.title,
        meta: t('alerts.daysOverdue', { count: item.days_overdue }),
        severity: item.severity,
      })),
    },
    {
      key: 'warranties',
      titleKey: 'alerts.sections.warranties',
      Icon: AlertTriangle,
      iconClass: 'text-amber-500',
      rows: summary.expiring_warranties.map((item) => ({
        key: `warranty-${item.id}`,
        to: item.entity_url,
        title: item.title,
        meta: t('alerts.warrantyExpiresIn', {
          count: item.days_remaining,
          date: item.warranty_expires_on,
        }),
        severity: item.severity,
      })),
    },
    {
      key: 'maintenances',
      titleKey: 'alerts.sections.maintenances',
      Icon: Wrench,
      iconClass: 'text-primary',
      rows: summary.due_maintenances.map((item) => ({
        key: `maintenance-${item.id}`,
        to: item.entity_url,
        title: item.title,
        meta: t('alerts.maintenanceDueIn', {
          count: item.days_remaining,
          date: item.next_service_due,
        }),
        severity: item.severity,
      })),
    },
    {
      key: 'chores',
      titleKey: 'alerts.sections.chores',
      Icon: Brush,
      iconClass: 'text-primary',
      rows: summary.due_chores.map((item) => ({
        key: `chore-${item.id}`,
        to: item.entity_url,
        title: item.emoji ? `${item.emoji} ${item.title}` : item.title,
        meta: choreMeta(t, item),
        severity: item.severity,
      })),
    },
    {
      key: 'stock',
      titleKey: 'alerts.sections.stock',
      Icon: Package,
      iconClass: 'text-amber-500',
      rows: summary.low_stock.map((item) => ({
        key: `stock-${item.id}`,
        to: item.entity_url,
        title: item.title,
        meta: `${t(`alerts.stockStatus.${item.status}`)} · ${t('alerts.stockRemaining', {
          quantity: item.quantity,
          unit: item.unit,
        })}`,
        severity: item.severity,
      })),
    },
    {
      key: 'weather',
      titleKey: 'alerts.sections.weather',
      Icon: CloudSun,
      iconClass: 'text-primary',
      rows: summary.weather_alerts.map((item, index) => ({
        key: `weather-${item.kind}-${item.date}-${index}`,
        to: item.entity_url,
        title: weatherTitle(t, item),
        meta: new Date(`${item.date}T00:00:00`).toLocaleDateString(locale, {
          weekday: 'long',
          day: 'numeric',
          month: 'short',
        }),
        severity: item.severity,
      })),
    },
    {
      key: 'eggDrop',
      titleKey: 'alerts.sections.eggDrop',
      Icon: Egg,
      iconClass: 'text-amber-500',
      rows: summary.egg_drop_alerts.map((item, index) => ({
        key: `egg-drop-${index}`,
        to: item.entity_url,
        title: t('alerts.eggDrop.title', { percent: item.drop_pct }),
        meta: t(`alerts.eggDrop.cause.${item.cause}`, {
          recent: item.recent_avg,
          baseline: item.baseline_avg,
        }),
        severity: item.severity,
      })),
    },
  ];

  return sections.filter((section) => section.rows.length > 0);
}

/**
 * Toutes les alertes en une liste, les critiques d'abord.
 *
 * L'aperçu de la cloche est tronqué : sans ce tri, une rupture de stock urgente
 * resterait derrière trois garanties tièdes simplement parce que sa section
 * vient plus bas sur la page.
 */
export function flattenAlertRows(sections: AlertSection[]): AlertRow[] {
  const rows = sections.flatMap((section) => section.rows);
  return [
    ...rows.filter((row) => row.severity === 'critical'),
    ...rows.filter((row) => row.severity !== 'critical'),
  ];
}
