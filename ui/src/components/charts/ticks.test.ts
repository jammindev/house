import { describe, expect, it } from 'vitest';
import { formatTick } from './ticks';

// L'axe des jours sert deux fenêtres très différentes : un mois (élec, eau) et
// 30 ou 90 jours d'affilée (stock). Le numéro du jour seul suffit à la première
// et rend la seconde illisible — « 13 » y apparaît deux ou trois fois sans dire
// lequel. Le mois s'ajoute donc dès que les barres changent de mois, et jamais
// avant : l'ajouter partout encombrerait un axe qui se lit très bien sans lui.
describe('formatTick', () => {
  it('ne montre que le numéro du jour quand les barres tiennent dans un mois', () => {
    expect(formatTick('2026-03-13T00:00:00+01:00', 'day', 'fr', false)).toBe('13');
  });

  it('ajoute le mois quand les barres en traversent plusieurs', () => {
    expect(formatTick('2026-03-13T00:00:00+01:00', 'day', 'fr', true)).toMatch(/13/);
    expect(formatTick('2026-03-13T00:00:00+01:00', 'day', 'fr', true)).not.toBe('13');
  });

  it('laisse les autres granularités inchangées', () => {
    expect(formatTick('2026-03-01T00:00:00+01:00', 'month', 'fr', true)).toMatch(/mars/i);
    expect(formatTick('2026-01-01T00:00:00+01:00', 'year', 'fr', true)).toBe('2026');
  });
});
