import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { resolvePeriod } from './period';

/**
 * Les bornes de période, vues depuis un fuseau à l'est de UTC.
 *
 * Le fuseau est imposé par le script `npm run test` (`TZ=Europe/Paris`), et ce
 * n'est pas un détail de confort : sous UTC le bug était **invisible**, ce qui
 * est exactement pourquoi il a vécu jusqu'en production. `toISOString()`
 * convertit avant de formater, donc minuit local reculait d'un jour — « ce
 * mois-ci » allait du 30 juin au 30 juillet.
 */
describe('resolvePeriod, vu depuis Paris', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    // 15 juillet 2026, milieu de mois : aucune borne n'est proche d'un bord,
    // donc un échec ne peut venir que du décalage de fuseau.
    vi.setSystemTime(new Date('2026-07-15T10:00:00+02:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it("le fuseau du test est bien à l'est de UTC, sinon il ne prouve rien", () => {
    expect(new Date().getTimezoneOffset()).toBeLessThan(0);
  });

  it('le mois en cours va du 1er au dernier jour, pas de la veille à l’avant-dernier', () => {
    expect(resolvePeriod({ preset: 'currentMonth' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('le mois précédent est un mois entier', () => {
    expect(resolvePeriod({ preset: 'previousMonth' })).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
  });

  it("l'année en cours commence le 1er janvier, pas le 31 décembre d'avant", () => {
    expect(resolvePeriod({ preset: 'currentYear' })).toEqual({
      from: '2026-01-01',
      to: '2026-12-31',
    });
  });

  it('les 30 derniers jours se terminent aujourd’hui', () => {
    expect(resolvePeriod({ preset: 'last30Days' })).toEqual({
      from: '2026-06-15',
      to: '2026-07-15',
    });
  });

  it('une période personnalisée est rendue telle quelle', () => {
    expect(resolvePeriod({ preset: 'custom', from: '2026-02-03', to: '2026-02-09' })).toEqual({
      from: '2026-02-03',
      to: '2026-02-09',
    });
  });
});
