import * as React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { render } from '@testing-library/react';

import StockLevelChart from './StockLevelChart';

/**
 * Ce que ces tests tiennent :
 *
 * 1. **Seuls les relevés portent un point.** C'est toute la différence avec les
 *    barres de #575 : un comptage est un fait, le trait entre deux comptages est
 *    une estimation. Un point sur chaque jour interpolé remettrait exactement la
 *    promesse de mesure qu'on vient de retirer.
 * 2. **Le pointillé n'existe que s'il y a une rupture à annoncer**, et il est
 *    visuellement distinct — sinon la projection se lit comme du mesuré.
 * 3. **Une seule série, pas de légende** (convention du projet, cf.
 *    `BalanceLineChart`) : une légende à une entrée répète le titre.
 */

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key, i18n: { language: 'fr' } }),
}));

// jsdom ne fait pas de mise en page : sans dimensions fixes, recharts n'émet
// aucun SVG. Ce qui se vérifie ici est le tracé, pas la responsivité.
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

// Cinq jours de niveau, deux comptages seulement : le 10 et le 14.
const levels = [
  { ts: '2026-08-10T00:00:00+02:00', quantity: 12 },
  { ts: '2026-08-11T00:00:00+02:00', quantity: 11 },
  { ts: '2026-08-12T00:00:00+02:00', quantity: 10 },
  { ts: '2026-08-13T00:00:00+02:00', quantity: 9 },
  { ts: '2026-08-14T00:00:00+02:00', quantity: 8 },
];

const readings = [
  { date: '2026-08-10T09:00:00+02:00', quantity: 12, kind: 'purchase' as const },
  { date: '2026-08-14T18:00:00+02:00', quantity: 8, kind: 'inventory' as const },
];

function renderChart(props: Partial<React.ComponentProps<typeof StockLevelChart>> = {}) {
  return render(
    <StockLevelChart
      levels={levels}
      readings={readings}
      depletionDate={null}
      horizonDays={90}
      unit="kg"
      {...props}
    />,
  );
}

describe('StockLevelChart', () => {
  it('ne marque que les jours réellement comptés', () => {
    const { container } = renderChart();

    // Cinq points de courbe, deux relevés : deux pastilles, pas cinq.
    expect(container.querySelectorAll('circle')).toHaveLength(readings.length);
  });

  it('trace la projection en pointillé jusqu’à la rupture', () => {
    const { container } = renderChart({ depletionDate: '2026-08-20' });

    const dashed = [...container.querySelectorAll('path.recharts-curve')].filter((path) =>
      path.getAttribute('stroke-dasharray'),
    );
    expect(dashed).toHaveLength(1);
  });

  it('ne trace aucune projection sans date de rupture', () => {
    const { container } = renderChart();

    const dashed = [...container.querySelectorAll('path.recharts-curve')].filter((path) =>
      path.getAttribute('stroke-dasharray'),
    );
    expect(dashed).toHaveLength(0);
    // Une série seule : pas de légende à une entrée.
    expect(container.querySelector('.recharts-legend-wrapper')).toBeNull();
  });

  it('nomme les deux traits dès qu’il y en a deux à distinguer', () => {
    const { container } = renderChart({ depletionDate: '2026-08-20' });

    const legend = container.querySelector('.recharts-legend-wrapper');
    expect(legend?.textContent).toContain('stock.consumption.level');
    expect(legend?.textContent).toContain('stock.consumption.projection');
  });
});
