import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { currentMonthKey, normalizePeriod, resolvePeriod, shiftMonth } from './period';

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
    expect(resolvePeriod({ preset: 'month', month: '2026-07' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
    });
  });

  it('un mois passé est un mois entier, quelle que soit sa longueur', () => {
    expect(resolvePeriod({ preset: 'month', month: '2026-06' })).toEqual({
      from: '2026-06-01',
      to: '2026-06-30',
    });
    // Février d'une année bissextile : le 29 ne doit pas déborder sur mars.
    expect(resolvePeriod({ preset: 'month', month: '2024-02' })).toEqual({
      from: '2024-02-01',
      to: '2024-02-29',
    });
  });

  it('un preset `month` sans mois retombe sur le mois en cours', () => {
    expect(resolvePeriod({ preset: 'month' })).toEqual({
      from: '2026-07-01',
      to: '2026-07-31',
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

describe('la navigation de mois en mois', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T10:00:00+02:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('le mois courant se lit dans le fuseau local, jamais en UTC', () => {
    expect(currentMonthKey()).toBe('2026-07');
  });

  it('recule et avance d’un mois', () => {
    expect(shiftMonth('2026-07', -1)).toBe('2026-06');
    expect(shiftMonth('2026-07', 1)).toBe('2026-08');
  });

  it('franchit le nouvel an dans les deux sens', () => {
    expect(shiftMonth('2026-01', -1)).toBe('2025-12');
    expect(shiftMonth('2025-12', 1)).toBe('2026-01');
  });

  it('ne dérive pas sur les mois courts — janvier + 1 vaut février, jamais mars', () => {
    // Un `setMonth` appliqué à une date au 31 déborde sur le mois suivant. Le
    // stepper raisonne sur (année, mois) et jamais sur un jour du calendrier.
    expect(shiftMonth('2026-01', 1)).toBe('2026-02');
    expect(shiftMonth('2026-03', -1)).toBe('2026-02');
  });
});

/**
 * Un état de période **déjà persisté** en sessionStorage survit au déploiement
 * qui change les presets — c'est tout l'intérêt de `useSessionState`.
 *
 * Sans normalisation, `{preset: 'currentMonth'}` écrit hier retombe demain dans
 * la branche `custom` de `resolvePeriod`, qui renvoie `{from: undefined, to:
 * undefined}` : la page interroge **tout l'historique du foyer** et affiche des
 * totaux sans rapport avec le libellé sélectionné. Le défaut ne frappe que ceux
 * qui utilisaient déjà l'écran — donc jamais celui qui l'écrit.
 */
describe('normalizePeriod — les états persistés survivent au changement de presets', () => {
  beforeAll(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-07-15T10:00:00+02:00'));
  });

  afterAll(() => {
    vi.useRealTimers();
  });

  it('« ce mois-ci » d’avant devient le mois courant, pas une fenêtre sans bornes', () => {
    const migrated = normalizePeriod({ preset: 'currentMonth' } as never);
    expect(migrated).toEqual({ preset: 'month', month: '2026-07' });
    expect(resolvePeriod(migrated)).toEqual({ from: '2026-07-01', to: '2026-07-31' });
  });

  it('« mois précédent » d’avant devient le mois précédent, une fois pour toutes', () => {
    expect(normalizePeriod({ preset: 'previousMonth' } as never)).toEqual({
      preset: 'month',
      month: '2026-06',
    });
  });

  it('un preset `month` sans mois est complété', () => {
    expect(normalizePeriod({ preset: 'month' })).toEqual({ preset: 'month', month: '2026-07' });
  });

  it('laisse intacts les presets encore valides', () => {
    expect(normalizePeriod({ preset: 'last30Days' })).toEqual({ preset: 'last30Days' });
    expect(normalizePeriod({ preset: 'custom', from: '2026-02-03', to: '2026-02-09' })).toEqual({
      preset: 'custom',
      from: '2026-02-03',
      to: '2026-02-09',
    });
  });

  it('un état corrompu ne casse pas la page — il retombe sur le mois courant', () => {
    expect(normalizePeriod(undefined as never)).toEqual({ preset: 'month', month: '2026-07' });
    expect(normalizePeriod({ preset: 'n’importe quoi' } as never)).toEqual({
      preset: 'month',
      month: '2026-07',
    });
  });
});
