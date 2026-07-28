import { describe, it, expect } from 'vitest';
import { groupPhotosByMonth } from './grouping';
import type { DocumentItem } from '@/lib/api/documents';

function photo(id: string, createdAt: string): DocumentItem {
  return { id, created_at: createdAt, name: id } as DocumentItem;
}

/**
 * Ce que ces tests tiennent :
 *
 * Le regroupement par mois doit se faire **dans le fuseau de l'utilisateur**. La
 * suite tourne en `TZ=Europe/Paris` (voir le script `test` du package.json), donc
 * une photo du 1er juillet à 00 h 30 locale est datée du 30 juin en UTC. Grouper
 * sur `toISOString().slice(0, 7)` la rangerait sous « juin » — même faute que
 * celle que `toLocalISODate` corrige pour les bornes de période.
 */
describe('groupPhotosByMonth', () => {
  it('range une photo du tout début de mois dans SON mois local, pas dans le précédent', () => {
    // 00 h 30 à Paris le 1er juillet = 22 h 30 UTC le 30 juin.
    const groups = groupPhotosByMonth([photo('p1', '2026-06-30T22:30:00Z')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-07');
  });

  it('préserve l’ordre reçu et sépare les mois', () => {
    const groups = groupPhotosByMonth([
      photo('juillet-recent', '2026-07-20T10:00:00Z'),
      photo('juillet-ancien', '2026-07-02T10:00:00Z'),
      photo('juin', '2026-06-15T10:00:00Z'),
    ]);

    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2026-06']);
    expect(groups[0].photos.map((p) => p.id)).toEqual(['juillet-recent', 'juillet-ancien']);
    expect(groups[1].photos.map((p) => p.id)).toEqual(['juin']);
  });

  it('regroupe le même mois de deux années différentes séparément', () => {
    const groups = groupPhotosByMonth([
      photo('2026', '2026-07-10T10:00:00Z'),
      photo('2025', '2025-07-10T10:00:00Z'),
    ]);

    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2025-07']);
  });

  it('ne perd pas une photo à date invalide', () => {
    const groups = groupPhotosByMonth([photo('cassée', 'pas-une-date')]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('unknown');
    expect(groups[0].photos).toHaveLength(1);
  });

  it('renvoie une liste vide sans photo', () => {
    expect(groupPhotosByMonth([])).toEqual([]);
  });
});
