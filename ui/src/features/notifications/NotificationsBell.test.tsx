import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';
import type { AlertsSummary } from '@/lib/api/alerts';
import { EMPTY_ALERTS_SUMMARY } from '@/features/alerts/rows';
import NotificationsBell from './NotificationsBell';

vi.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }) }));

const state = vi.hoisted(() => ({
  notifications: [] as Array<Record<string, unknown>>,
  unread: 0,
  alerts: null as AlertsSummary | null,
}));

const markAllRead = vi.hoisted(() => vi.fn());

vi.mock('./hooks', () => ({
  useNotifications: () => ({ data: state.notifications }),
  useUnreadCount: () => ({ data: state.unread }),
  useMarkAllRead: () => ({ mutate: markAllRead, isPending: false }),
  useMarkRead: () => ({ mutate: vi.fn() }),
}));

vi.mock('@/features/alerts/hooks', () => ({
  useAlertsSummary: () => ({ data: state.alerts }),
}));

vi.mock('@/features/settings/hooks', () => ({
  useAcceptInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, variables: undefined }),
  useDeclineInvitation: () => ({ mutateAsync: vi.fn(), isPending: false, variables: undefined }),
}));

function alertsWith(partial: Partial<AlertsSummary>): AlertsSummary {
  const summary = { ...EMPTY_ALERTS_SUMMARY, ...partial };
  const total = Object.values(summary).filter(Array.isArray).reduce((n, list) => n + list.length, 0);
  return { ...summary, total };
}

function overdueTask(id: string, title: string) {
  return {
    id,
    title,
    due_date: '2026-07-30',
    days_overdue: 3,
    entity_url: `/app/tasks/${id}`,
    severity: 'critical' as const,
  };
}

function expiringWarranty(id: string, title: string) {
  return {
    id,
    title,
    warranty_expires_on: '2026-09-01',
    days_remaining: 28,
    entity_url: `/app/equipment/${id}`,
    severity: 'warning' as const,
  };
}

beforeAll(() => {
  // Radix pilote son menu à la souris ; jsdom n'implémente pas la capture de pointeur.
  Element.prototype.hasPointerCapture = () => false;
  Element.prototype.setPointerCapture = () => {};
  Element.prototype.releasePointerCapture = () => {};
  Element.prototype.scrollIntoView = () => {};
});

beforeEach(() => {
  state.notifications = [];
  state.unread = 0;
  state.alerts = null;
  markAllRead.mockClear();
});

async function openBell() {
  const user = userEvent.setup({ pointerEventsCheck: 0 });
  render(<MemoryRouter><NotificationsBell /></MemoryRouter>);
  await user.click(screen.getByTestId('notifications-bell'));
  return user;
}

describe('NotificationsBell — les alertes du foyer', () => {
  /**
   * La régression qui fonde tout le reste.
   *
   * Une notification est un événement (lu/non-lu, écartable) ; une alerte est un
   * état recalculé qu'on ne peut pas écarter. Additionner les deux dans le badge
   * fabriquerait un compteur qui ne redescend jamais — et un compteur qui ne
   * redescend jamais devient du décor qu'on cesse de lire.
   */
  it("ne compte pas les alertes dans le badge des non-lus", async () => {
    state.unread = 0;
    state.alerts = alertsWith({
      overdue_tasks: [overdueTask('t1', 'Tondre la pelouse'), overdueTask('t2', 'Relever le compteur')],
    });

    render(<MemoryRouter><NotificationsBell /></MemoryRouter>);

    expect(screen.queryByTestId('notifications-bell-badge')).not.toBeInTheDocument();
    expect(screen.getByTestId('notifications-bell-alerts-dot')).toBeInTheDocument();
  });

  it("n'affiche pas de point quand le foyer n'a aucune alerte", async () => {
    state.unread = 2;
    state.alerts = alertsWith({});

    render(<MemoryRouter><NotificationsBell /></MemoryRouter>);

    expect(screen.getByTestId('notifications-bell-badge')).toHaveTextContent('2');
    expect(screen.queryByTestId('notifications-bell-alerts-dot')).not.toBeInTheDocument();
  });

  it("mène de l'alerte à l'entité concernée", async () => {
    state.alerts = alertsWith({ overdue_tasks: [overdueTask('t1', 'Tondre la pelouse')] });

    await openBell();

    expect(screen.getByRole('link', { name: /Tondre la pelouse/ })).toHaveAttribute(
      'href',
      '/app/tasks/t1',
    );
  });

  // L'aperçu est tronqué : c'est l'urgent qui doit survivre à la troncature.
  it("montre les alertes critiques d'abord, et pas plus de trois", async () => {
    state.alerts = alertsWith({
      expiring_warranties: [
        expiringWarranty('w1', 'Garantie four'),
        expiringWarranty('w2', 'Garantie lave-linge'),
        expiringWarranty('w3', 'Garantie chaudière'),
      ],
      overdue_tasks: [overdueTask('t1', 'Tondre la pelouse')],
    });

    await openBell();

    const shown = screen.getAllByTestId('bell-alert-row').map((row) => row.textContent);
    expect(shown).toHaveLength(3);
    expect(shown[0]).toContain('Tondre la pelouse');
    expect(shown.join(' ')).not.toContain('Garantie chaudière');
  });

  /** Les deux listes ne partagent ni cycle de vie ni compteur. */
  it("garde les alertes visibles quand il n'y a aucune notification", async () => {
    state.notifications = [];
    state.alerts = alertsWith({ overdue_tasks: [overdueTask('t1', 'Tondre la pelouse')] });

    await openBell();

    expect(screen.getByText('notifications.empty')).toBeInTheDocument();
    expect(screen.getByText('Tondre la pelouse')).toBeInTheDocument();
  });

  it("n'offre pas de « tout marquer lu » pour des alertes", async () => {
    state.unread = 0;
    state.alerts = alertsWith({ overdue_tasks: [overdueTask('t1', 'Tondre la pelouse')] });

    await openBell();

    expect(screen.queryByText('notifications.markAllRead')).not.toBeInTheDocument();
  });
});
