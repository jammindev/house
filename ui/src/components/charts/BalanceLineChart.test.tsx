import * as React from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import BalanceLineChart, { type BalanceChartSeries } from './BalanceLineChart';

/**
 * Ce que ces tests tiennent :
 *
 * 1. **Une courbe fausse mais plausible se signale.** Une rupture dans la chaîne
 *    des soldes décale tout le passé du même montant : la forme reste normale et
 *    rien ne se voit. C'est le seul cas où un graphique parfaitement lisible ment,
 *    donc le bandeau n'est pas décoratif — sans lui la régression est invisible.
 * 2. **Un solde ne s'interpole pas.** `stepAfter` dit qu'un solde tient jusqu'à ce
 *    que quelque chose le bouge ; une courbe lissée dessinerait de l'argent
 *    arrivant petit à petit sur des jours où rien n'a bougé, et une pente se lit
 *    comme une tendance.
 * 3. **Une série seule n'a pas de légende, plusieurs si.** Une légende à une
 *    entrée répète le titre ; à plusieurs, c'est le seul moyen de savoir quelle
 *    ligne est quel compte sans passer la souris dessus.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

/**
 * `ResponsiveContainer` mesure son parent ; jsdom ne fait pas de mise en page et
 * renvoie 0×0, donc recharts n'émet aucun SVG. On lui substitue des dimensions
 * fixes — ce qui est testé ici est le tracé, pas la responsivité (qui ne se
 * vérifie de toute façon que dans un vrai moteur).
 */
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: React.ReactElement<{ width?: number; height?: number }>;
    }) => React.cloneElement(children, { width: 800, height: 300 }),
  };
});

const points = [
  { on: '2026-01-01', amount: '1000.00' },
  { on: '2026-02-01', amount: '900.00' },
  { on: '2026-03-01', amount: '1250.00' },
];

const single: BalanceChartSeries[] = [
  { key: 'balance', label: 'Solde', color: 'hsl(var(--chart-1))', emphasis: true, points },
];

describe('BalanceLineChart', () => {
  it('dit quand la chaîne des soldes est trouée', () => {
    render(<BalanceLineChart series={single} unreliable />);

    expect(screen.getByText('banking.history.unreliable')).toBeInTheDocument();
  });

  it('ne crie pas quand la chaîne est saine', () => {
    render(<BalanceLineChart series={single} />);

    expect(screen.queryByText('banking.history.unreliable')).not.toBeInTheDocument();
  });

  it('trace des marches, jamais une courbe lissée', () => {
    const { container } = render(<BalanceLineChart series={single} />);

    // Une marche ne produit que des segments horizontaux et verticaux : aucune
    // commande de courbe de Bézier dans le tracé.
    const path = container.querySelector('.recharts-line-curve');
    expect(path).not.toBeNull();
    expect(path?.getAttribute('d')).not.toMatch(/[CQS]/);
  });

  it('se passe de légende sur une série unique', () => {
    const { container } = render(<BalanceLineChart series={single} />);

    expect(container.querySelector('.recharts-legend-wrapper')).toBeNull();
  });

  it('affiche une légende dès qu’il y a plusieurs comptes', () => {
    const series: BalanceChartSeries[] = [
      { key: 'total', label: 'Total', color: 'hsl(var(--foreground))', emphasis: true, points },
      { key: 'acc-1', label: 'Compte joint', color: 'hsl(var(--chart-1))', points },
    ];

    render(<BalanceLineChart series={series} />);

    expect(screen.getByText('Total')).toBeInTheDocument();
    expect(screen.getByText('Compte joint')).toBeInTheDocument();
  });

  it('ne rend rien plutôt qu’un cadre vide sans données', () => {
    const { container } = render(<BalanceLineChart series={[]} />);

    expect(container).toBeEmptyDOMElement();
  });
});
