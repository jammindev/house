import { describe, it, expect } from 'vitest';
import { groupDocuments, countByType, isWithoutContext } from './grouping';
import type { DocumentItem } from '@/lib/api/documents';

function doc(
  id: string,
  type: string,
  createdAt = '2026-07-10T10:00:00Z',
  qualification?: Partial<DocumentItem['qualification']>,
): DocumentItem {
  return {
    id,
    name: id,
    type,
    created_at: createdAt,
    qualification: {
      has_activity_context: false,
      qualification_state: 'without_activity',
      linked_interactions_count: 0,
      has_secondary_context: false,
      ...qualification,
    },
  } as DocumentItem;
}

/**
 * Ce que ces tests tiennent :
 *
 * L'ordre des sections en mode « type » vient du **catalogue**, pas du volume. Un
 * ordre qui suit les compteurs se réorganise à chaque import : la section qu'on
 * vise n'est jamais deux fois à la même place, et c'est justement la mémoire de la
 * position qui rend une longue liste navigable.
 */
describe('groupDocuments — mode type', () => {
  it('ordonne les sections selon le catalogue, pas selon le volume', () => {
    // « other » est dernier au catalogue mais majoritaire ici ; « invoice » vient
    // avant « manual », qui vient avant « other ».
    const groups = groupDocuments(
      [
        doc('a', 'other'),
        doc('b', 'other'),
        doc('c', 'other'),
        doc('d', 'manual'),
        doc('e', 'invoice'),
      ],
      'type',
    );

    expect(groups.map((g) => g.key)).toEqual(['invoice', 'manual', 'other']);
  });

  it('préserve l’ordre reçu du serveur à l’intérieur d’une section', () => {
    const groups = groupDocuments(
      [
        doc('recent', 'invoice', '2026-07-20T10:00:00Z'),
        doc('ancien', 'invoice', '2026-01-05T10:00:00Z'),
      ],
      'type',
    );

    expect(groups[0].documents.map((d) => d.id)).toEqual(['recent', 'ancien']);
  });

  it('ne perd pas un type hors catalogue — il ferme la marche', () => {
    const groups = groupDocuments([doc('legacy', 'contrat'), doc('f', 'invoice')], 'type');

    expect(groups.map((g) => g.key)).toEqual(['invoice', 'contrat']);
    expect(groups[1].documents).toHaveLength(1);
  });

  it('expose le type à traduire et jamais d’ancre de date', () => {
    const [group] = groupDocuments([doc('a', 'invoice')], 'type');

    expect(group.type).toBe('invoice');
    expect(group.anchor).toBeNull();
  });

  it('range un type vide sous « document », le défaut du backend', () => {
    const groups = groupDocuments([doc('a', '')], 'type');

    expect(groups.map((g) => g.key)).toEqual(['document']);
  });
});

/**
 * Ce que ces tests tiennent :
 *
 * Le regroupement par mois se fait **dans le fuseau de l'utilisateur**. La suite
 * tourne en `TZ=Europe/Paris`, donc un document ajouté le 1er juillet à 00 h 30
 * locale est daté du 30 juin en UTC. Grouper sur `toISOString().slice(0, 7)` le
 * rangerait sous « juin » — même faute que celle que `toLocalISODate` corrige pour
 * les bornes de période.
 */
describe('groupDocuments — mode date', () => {
  it('range un document du tout début de mois dans SON mois local', () => {
    // 00 h 30 à Paris le 1er juillet = 22 h 30 UTC le 30 juin.
    const groups = groupDocuments([doc('a', 'invoice', '2026-06-30T22:30:00Z')], 'date');

    expect(groups.map((g) => g.key)).toEqual(['2026-07']);
  });

  it('sépare les mois en préservant l’ordre reçu, tous types mêlés', () => {
    const groups = groupDocuments(
      [
        doc('juillet-facture', 'invoice', '2026-07-20T10:00:00Z'),
        doc('juillet-manuel', 'manual', '2026-07-02T10:00:00Z'),
        doc('juin', 'plan', '2026-06-15T10:00:00Z'),
      ],
      'date',
    );

    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2026-06']);
    expect(groups[0].documents.map((d) => d.id)).toEqual(['juillet-facture', 'juillet-manuel']);
  });

  it('regroupe le même mois de deux années différentes séparément', () => {
    const groups = groupDocuments(
      [doc('2026', 'invoice', '2026-07-10T10:00:00Z'), doc('2025', 'invoice', '2025-07-10T10:00:00Z')],
      'date',
    );

    expect(groups.map((g) => g.key)).toEqual(['2026-07', '2025-07']);
  });

  it('expose l’ancre à formater et jamais de type', () => {
    const [group] = groupDocuments([doc('a', 'invoice', '2026-07-10T10:00:00Z')], 'date');

    expect(group.anchor).toBe('2026-07-10T10:00:00Z');
    expect(group.type).toBeNull();
  });

  it('ne perd pas un document à date invalide', () => {
    const groups = groupDocuments([doc('cassé', 'invoice', 'pas-une-date')], 'date');

    expect(groups.map((g) => g.key)).toEqual(['unknown']);
    expect(groups[0].documents).toHaveLength(1);
  });

  it('renvoie une liste vide sans document', () => {
    expect(groupDocuments([], 'date')).toEqual([]);
    expect(groupDocuments([], 'type')).toEqual([]);
  });
});

/**
 * Ce que ces tests tiennent :
 *
 * Les compteurs des pastilles se lisent sur la liste **déjà filtrée par la
 * recherche**. Un compteur qui annoncerait 18 factures alors que la recherche
 * courante n'en montre que deux dirait le contraire de ce que le clic produit.
 */
describe('countByType', () => {
  it('compte par type et expose le total sous la clé vide', () => {
    const counts = countByType([doc('a', 'invoice'), doc('b', 'invoice'), doc('c', 'manual')]);

    expect(counts).toEqual({ '': 3, invoice: 2, manual: 1 });
  });

  it('n’invente pas de zéro pour un type absent', () => {
    const counts = countByType([doc('a', 'invoice')]);

    expect(counts.manual).toBeUndefined();
  });

  it('donne un total nul sur une liste vide', () => {
    expect(countByType([])).toEqual({ '': 0 });
  });
});

/**
 * Ce que ce test tient :
 *
 * Une seule définition de « sans contexte », partagée par la pastille de filtre et
 * le badge de la carte. « 12 sans contexte » face à onze badges à l'écran fait
 * perdre son crédit aux deux compteurs.
 */
describe('isWithoutContext', () => {
  it('est vrai sans activité ni contexte secondaire', () => {
    expect(isWithoutContext(doc('a', 'invoice'))).toBe(true);
  });

  it('est faux dès qu’une activité est liée', () => {
    const linked = doc('a', 'invoice', '2026-07-10T10:00:00Z', {
      qualification_state: 'activity_linked',
      has_activity_context: true,
      linked_interactions_count: 1,
    });
    expect(isWithoutContext(linked)).toBe(false);
  });

  it('est faux si une zone ou un projet donne déjà un contexte', () => {
    const zoned = doc('a', 'invoice', '2026-07-10T10:00:00Z', { has_secondary_context: true });
    expect(isWithoutContext(zoned)).toBe(false);
  });
});
