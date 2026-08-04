import { describe, expect, it } from 'vitest';
import type { AlertsSummary } from '@/lib/api/alerts';
import { EMPTY_ALERTS_SUMMARY, buildAlertSections, flattenAlertRows } from './rows';

/** Le `t` d'i18next, réduit à ce qu'on veut prouver : la clé et ses paramètres.
 *
 * Comparer un rendu français ne dirait rien — ce qui compte est que la page et
 * la cloche demandent *la même* clé avec *les mêmes* paramètres.
 */
const t = (key: string, options?: Record<string, unknown>) =>
  options ? `${key}(${JSON.stringify(options)})` : key;

function summaryOf(partial: Partial<AlertsSummary>): AlertsSummary {
  const summary = { ...EMPTY_ALERTS_SUMMARY, ...partial };
  const total = Object.values(summary).filter(Array.isArray).reduce((n, list) => n + list.length, 0);
  return { ...summary, total };
}

describe('buildAlertSections', () => {
  it('ne renvoie que les sections qui ont quelque chose à dire', () => {
    const sections = buildAlertSections(summaryOf({}), t, 'fr');

    expect(sections).toEqual([]);
  });

  it("dit le retard d'une tâche et mène à la tâche", () => {
    const sections = buildAlertSections(
      summaryOf({
        overdue_tasks: [
          {
            id: 'task-1',
            title: 'Tondre la pelouse',
            due_date: '2026-07-30',
            days_overdue: 3,
            entity_url: '/app/tasks/task-1',
            severity: 'critical',
          },
        ],
      }),
      t,
      'fr',
    );

    expect(sections).toHaveLength(1);
    expect(sections[0].titleKey).toBe('alerts.sections.overdue');
    expect(sections[0].rows[0]).toMatchObject({
      to: '/app/tasks/task-1',
      title: 'Tondre la pelouse',
      meta: 'alerts.daysOverdue({"count":3})',
      severity: 'critical',
    });
  });

  // Une corvée jamais faite n'est pas une corvée « en retard de 0 jour » : les
  // trois branches de `AlertsPage` doivent survivre à l'extraction.
  it('distingue la corvée jamais faite, celle du jour et celle en retard', () => {
    const chore = {
      id: 'c1',
      title: 'Nettoyer le poulailler',
      emoji: '🧹',
      interval_days: 7,
      next_due_on: '2026-08-04',
      days_overdue: 0,
      never_done: false,
      entity_url: '/app/chickens/chores/c1',
      severity: 'warning' as const,
    };
    const metaOf = (over: Partial<typeof chore>) =>
      buildAlertSections(summaryOf({ due_chores: [{ ...chore, ...over }] }), t, 'fr')[0].rows[0].meta;

    expect(metaOf({ never_done: true })).toBe('alerts.choreNeverDone({"count":7})');
    expect(metaOf({})).toBe('alerts.choreDueToday');
    expect(metaOf({ days_overdue: 2 })).toBe(
      'alerts.choreOverdue({"count":2,"date":"2026-08-04"})',
    );
  });

  it("préfixe la corvée de son emoji quand elle en a un", () => {
    const rows = buildAlertSections(
      summaryOf({
        due_chores: [
          {
            id: 'c1',
            title: 'Nettoyer le poulailler',
            emoji: '🧹',
            interval_days: 7,
            next_due_on: '2026-08-04',
            days_overdue: 1,
            never_done: false,
            entity_url: '/app/chickens/chores/c1',
            severity: 'warning',
          },
        ],
      }),
      t,
      'fr',
    )[0].rows;

    expect(rows[0].title).toBe('🧹 Nettoyer le poulailler');
  });
});

describe('flattenAlertRows', () => {
  // La cloche n'affiche que trois lignes : si l'ordre des sections primait, une
  // rupture de stock urgente resterait cachée derrière trois garanties tièdes.
  it('remonte les alertes critiques avant les avertissements', () => {
    const sections = buildAlertSections(
      summaryOf({
        expiring_warranties: [
          {
            id: 'w1',
            title: 'Garantie four',
            warranty_expires_on: '2026-09-01',
            days_remaining: 28,
            entity_url: '/app/equipment/w1',
            severity: 'warning',
          },
        ],
        low_stock: [
          {
            id: 's1',
            title: 'Croquettes',
            status: 'out_of_stock',
            quantity: '0',
            min_quantity: '2',
            unit: 'kg',
            entity_url: '/app/stock/s1',
            severity: 'critical',
          },
        ],
      }),
      t,
      'fr',
    );

    expect(flattenAlertRows(sections).map((row) => row.title)).toEqual([
      'Croquettes',
      'Garantie four',
    ]);
  });

  it('donne à chaque ligne une clé de rendu unique', () => {
    const sections = buildAlertSections(
      summaryOf({
        weather_alerts: [
          { kind: 'frost', date: '2026-08-05', value: -2, unit: '°C', entity_url: '/app/weather', severity: 'warning' },
          { kind: 'frost', date: '2026-08-05', value: -2, unit: '°C', entity_url: '/app/weather', severity: 'warning' },
        ],
      }),
      t,
      'fr',
    );

    const keys = flattenAlertRows(sections).map((row) => row.key);
    expect(new Set(keys).size).toBe(keys.length);
  });
});
