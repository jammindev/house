import { describe, it, expect } from 'vitest';
import { groupPhotosByMonth, effectiveDate, hasCaptureDate } from './grouping';
import type { DocumentItem } from '@/lib/api/documents';

function photo(id: string, createdAt: string, takenAt?: string | null): DocumentItem {
  return { id, created_at: createdAt, taken_at: takenAt ?? null, name: id } as DocumentItem;
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

/**
 * Ce que ces tests tiennent :
 *
 * Le groupement doit se faire sur la **date de prise de vue** quand elle existe, pas
 * sur la date d'ajout. C'est tout l'objet du changement : une série prise en juin et
 * importée en juillet apparaissait sous « juillet ».
 *
 * Et l'en-tête de mois doit rester d'accord avec le tri, qui vient du serveur
 * (`ordering=-effective_date`, soit `COALESCE(taken_at, created_at)`). S'ils
 * divergeaient, une photo se retrouverait sous un en-tête « juillet » entre deux
 * photos de juin : la liste semblerait mal triée alors que c'est l'étiquette qui
 * mentirait.
 */
describe('date effective', () => {
  it('préfère la date de prise de vue à la date d’ajout', () => {
    const p = photo('p', '2026-07-20T10:00:00Z', '2026-06-14T13:30:00Z');
    expect(effectiveDate(p)).toBe('2026-06-14T13:30:00Z');
    expect(hasCaptureDate(p)).toBe(true);
  });

  it('retombe sur la date d’ajout quand l’EXIF n’a rien dit', () => {
    const p = photo('p', '2026-07-20T10:00:00Z', null);
    expect(effectiveDate(p)).toBe('2026-07-20T10:00:00Z');
    expect(hasCaptureDate(p)).toBe(false);
  });

  it('range une photo importée en juillet sous son mois de prise de vue', () => {
    const groups = groupPhotosByMonth([
      photo('prise-en-juin', '2026-07-20T10:00:00Z', '2026-06-14T13:30:00Z'),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-06');
    // L'ancre sert à formater l'en-tête : elle doit être la date de prise, sinon
    // le titre annoncerait « juillet 2026 » au-dessus d'un groupe de juin.
    expect(groups[0].anchor).toBe('2026-06-14T13:30:00Z');
  });

  it('mêle datées et non datées dans l’ordre reçu du serveur', () => {
    // Ce que renvoie `-effective_date` : prise le 15/06, puis ajoutée le 01/06.
    const groups = groupPhotosByMonth([
      photo('prise-le-15-juin', '2026-07-20T10:00:00Z', '2026-06-15T12:00:00Z'),
      photo('ajoutee-le-1er-juin', '2026-06-01T12:00:00Z', null),
    ]);

    expect(groups).toHaveLength(1);
    expect(groups[0].key).toBe('2026-06');
    expect(groups[0].photos.map((p) => p.id)).toEqual([
      'prise-le-15-juin',
      'ajoutee-le-1er-juin',
    ]);
  });

  it('applique la règle du fuseau local à la date de prise, pas seulement à l’ajout', () => {
    // 00 h 30 à Paris le 1er juillet = 22 h 30 UTC le 30 juin.
    const groups = groupPhotosByMonth([
      photo('p', '2026-09-01T10:00:00Z', '2026-06-30T22:30:00Z'),
    ]);

    expect(groups[0].key).toBe('2026-07');
  });
});
