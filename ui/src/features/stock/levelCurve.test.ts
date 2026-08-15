import { describe, expect, it } from 'vitest';

import {
  buildCurveRows,
  buildProjection,
  canOverlayWeather,
  dayKey,
} from './levelCurve';

const LAST = '2026-08-10T00:00:00+02:00';

describe('buildProjection', () => {
  it('descend du dernier niveau connu jusqu’à zéro le jour de la rupture', () => {
    const rows = buildProjection({
      lastTs: LAST,
      lastQuantity: 12,
      depletionDate: '2026-08-20',
      horizonDays: 90,
    });

    // Un point par jour, les deux bornes incluses.
    expect(rows).toHaveLength(11);
    expect(rows[0].projection).toBe(12);
    expect(rows[rows.length - 1].projection).toBe(0);
    // 12 kg sur 10 jours : la descente est régulière.
    expect(rows[1].projection).toBeCloseTo(10.8, 3);
  });

  it('part du dernier niveau connu, jamais d’une extrapolation', () => {
    const [first] = buildProjection({
      lastTs: LAST,
      lastQuantity: 12,
      depletionDate: '2026-09-25',
      horizonDays: 90,
    });

    expect(first.ts).toBe(dayKey(LAST));
    expect(first.projection).toBe(12);
  });

  it('s’arrête à l’horizon plutôt que d’écraser l’historique', () => {
    // Un article lent : la rupture est dans dix ans.
    const rows = buildProjection({
      lastTs: LAST,
      lastQuantity: 12,
      depletionDate: '2036-08-10',
      horizonDays: 30,
    });

    expect(rows).toHaveLength(31);
    // Le pointillé sort du cadre sans atteindre zéro : il ne ment pas sur la date.
    expect(rows[rows.length - 1].projection).toBeGreaterThan(11);
  });

  it('ne trace rien sans date de rupture ni sur un article déjà vide', () => {
    const base = { lastTs: LAST, horizonDays: 90 };
    expect(buildProjection({ ...base, lastQuantity: 12, depletionDate: null })).toEqual([]);
    expect(buildProjection({ ...base, lastQuantity: 0, depletionDate: '2026-09-25' })).toEqual([]);
  });
});

describe('buildCurveRows', () => {
  it('joint le trait plein et le pointillé sur le même point', () => {
    const levels = [
      { ts: '2026-08-09T00:00:00+02:00', quantity: 13 },
      { ts: LAST, quantity: 12 },
    ];
    const projection = buildProjection({
      lastTs: LAST,
      lastQuantity: 12,
      depletionDate: '2026-08-12',
      horizonDays: 90,
    });

    const rows = buildCurveRows(levels, projection);

    // La jonction porte les deux valeurs : sans ça les lignes ne se touchent pas.
    const junction = rows.find((row) => row.ts === dayKey(LAST));
    expect(junction).toEqual({ ts: dayKey(LAST), level: 12, projection: 12 });
    // Avant le premier relevé, aucune ligne — « on ne sait pas » n’est pas zéro.
    expect(rows[0].ts).toBe(dayKey('2026-08-09'));
    expect(rows.map((row) => row.ts)).toEqual([...rows.map((row) => row.ts)].sort());
  });

  it('garde une clé d’axe insensible au fuseau du navigateur', () => {
    // Minuit dans le fuseau du foyer, rendu par un navigateur à l’ouest,
    // reculerait d’un jour : la clé est ancrée à midi local.
    expect(dayKey('2026-08-10T00:00:00+02:00')).toBe('2026-08-10T12:00:00');
    expect(new Date(dayKey(LAST)).getDate()).toBe(10);
  });
});

describe('canOverlayWeather', () => {
  it('exige assez de relevés pour que la pente ait le droit de varier', () => {
    // Deux relevés = une droite unique : la température ne peut rien y répondre.
    expect(canOverlayWeather(2)).toBe(false);
    expect(canOverlayWeather(3)).toBe(false);
    expect(canOverlayWeather(4)).toBe(true);
  });
});
