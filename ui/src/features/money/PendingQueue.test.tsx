import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import PendingQueue from './PendingQueue';

/**
 * Ce que ces tests tiennent : **la file a un curseur, et une seule ligne à la
 * fois porte ses pastilles.**
 *
 * Les vingt-trois budgets étaient dessinés sur *chaque* carte. À vingt lignes,
 * la file faisait douze mille pixels du même mur de boutons, et le geste — une
 * pastille, un clic, l'opération rangée — se payait d'un défilement à chaque
 * ligne. Le curseur garde le clic unique là où on travaille et ne dessine la
 * grille qu'une fois.
 *
 * Trois règles, et la troisième est la seule qui ne se voit pas en relecture :
 *
 * 1. la première ligne s'ouvre toute seule — une file qui s'ouvre fermée demande
 *    un clic pour commencer, et ce clic n'apprend rien ;
 * 2. cliquer une ligne y déplace le curseur — c'est un curseur, pas un
 *    accordéon : on choisit ce qu'on range ;
 * 3. **quand la ligne focalisée quitte la file, le curseur passe à la suivante.**
 *    Sans ça, ranger une opération replierait tout et il faudrait rouvrir la
 *    ligne d'après à la main : le mur disparaîtrait au prix d'un clic par ligne,
 *    soit exactement ce qu'on venait d'économiser.
 */

const state = vi.hoisted(() => ({
  rows: [] as { id: string; label: string; bookedOn: string; amount: string }[],
}));

vi.mock('react-i18next', () => ({
  useTranslation: () => ({
    t: (key: string, vars?: Record<string, unknown>) =>
      vars ? `${key}:${Object.values(vars).join(',')}` : key,
    i18n: { language: 'fr' },
  }),
}));

vi.mock('./hooks', () => ({
  useComplianceGroup: (kind: string) => ({
    // Seul le détecteur des sorties non ventilées porte des lignes : le curseur
    // ne dépend pas du détecteur qui a signalé, seulement de l'ordre de la file.
    data:
      kind === 'transaction_unallocated'
        ? {
            open: state.rows.length,
            results: state.rows.map((row) => ({
              kind,
              object_id: row.id,
              label: row.label,
              fingerprint: row.id,
              detail: {
                label: row.label,
                account_name: 'Compte joint',
                booked_on: row.bookedOn,
                outflow: row.amount,
              },
              is_stale: false,
              waiver_id: null,
              waiver_reason: '',
            })),
          }
        : { open: 0, results: [] },
    isLoading: false,
    isFetching: false,
  }),
  useComplianceSummary: () => ({ data: undefined }),
}));

vi.mock('@/features/budget/hooks', () => ({
  useBudgets: () => ({
    data: [
      { id: 'b1', name: 'Courses', is_global: false },
      { id: 'b2', name: 'Santé', is_global: false },
    ],
  }),
}));

vi.mock('@/features/banking/hooks', () => ({
  useSetAllocations: () => ({ mutateAsync: vi.fn() }),
  useQualifyTransaction: () => ({ mutateAsync: vi.fn() }),
  useAllocations: () => ({ data: undefined }),
}));

vi.mock('@/features/banking/AllocationDialog', () => ({ default: () => null }));
vi.mock('@/features/banking/ClassifyInflowDialog', () => ({ default: () => null }));
vi.mock('./WaiverDialog', () => ({ default: () => null }));

/** Le rang d'une opération : le bouton de divulgation qui porte son libellé. */
function rowHeader(label: string) {
  return screen.getByRole('button', { name: new RegExp(label) });
}

describe('PendingQueue — le curseur de la file', () => {
  beforeEach(() => {
    state.rows = [
      { id: 't1', label: 'PHARMACIE DU PARC', bookedOn: '2026-08-05', amount: '26.90' },
      { id: 't2', label: 'LECLERC DRIVE', bookedOn: '2026-08-06', amount: '84.10' },
      { id: 't3', label: 'TOTAL ENERGIES', bookedOn: '2026-08-07', amount: '61.00' },
    ];
  });

  it('ouvre la première ligne et ne dessine les pastilles qu’une fois', () => {
    render(<PendingQueue />);

    expect(rowHeader('PHARMACIE DU PARC')).toHaveAttribute('aria-expanded', 'true');
    expect(rowHeader('LECLERC DRIVE')).toHaveAttribute('aria-expanded', 'false');
    expect(rowHeader('TOTAL ENERGIES')).toHaveAttribute('aria-expanded', 'false');

    // Le point de tout le changement : une grille, pas une par ligne.
    expect(screen.getAllByRole('button', { name: 'Courses' })).toHaveLength(1);
  });

  it('déplace le curseur sur la ligne cliquée', async () => {
    const user = userEvent.setup();
    render(<PendingQueue />);

    await user.click(rowHeader('TOTAL ENERGIES'));

    expect(rowHeader('TOTAL ENERGIES')).toHaveAttribute('aria-expanded', 'true');
    expect(rowHeader('PHARMACIE DU PARC')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getAllByRole('button', { name: 'Courses' })).toHaveLength(1);
  });

  it('avance sur la suivante quand la ligne focalisée quitte la file', async () => {
    const user = userEvent.setup();
    render(<PendingQueue />);

    // « Plus tard » sort la ligne de la file sans rien écrire — même effet, du
    // point de vue du curseur, que la ranger ou l'arbitrer.
    await user.click(screen.getByRole('button', { name: 'money.pending.later' }));

    expect(screen.queryByRole('button', { name: /PHARMACIE DU PARC/ })).toBeNull();
    expect(rowHeader('LECLERC DRIVE')).toHaveAttribute('aria-expanded', 'true');
  });

  it('laisse fermée une ligne fermée volontairement', async () => {
    const user = userEvent.setup();
    render(<PendingQueue />);

    await user.click(rowHeader('PHARMACIE DU PARC'));

    expect(rowHeader('PHARMACIE DU PARC')).toHaveAttribute('aria-expanded', 'false');
    expect(screen.queryByRole('button', { name: 'Courses' })).toBeNull();
  });
});
