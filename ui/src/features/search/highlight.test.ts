import { describe, expect, it } from 'vitest';
import { parseSnippet, stripMarkers } from './highlight';

describe('parseSnippet', () => {
  it('renvoie un seul segment neutre sans marqueur', () => {
    expect(parseSnippet('rien à surligner')).toEqual([
      { text: 'rien à surligner', match: false },
    ]);
  });

  it('isole le terme trouvé entre les marqueurs', () => {
    expect(parseSnippet('remplacement de la <<chaudière>> au fioul')).toEqual([
      { text: 'remplacement de la ', match: false },
      { text: 'chaudière', match: true },
      { text: ' au fioul', match: false },
    ]);
  });

  it('gère plusieurs occurrences', () => {
    const segments = parseSnippet('<<pompe>> à chaleur et <<pompe>> de puits');
    expect(segments.filter((s) => s.match).map((s) => s.text)).toEqual(['pompe', 'pompe']);
    expect(stripMarkers('<<pompe>> à chaleur et <<pompe>> de puits')).toBe(
      'pompe à chaleur et pompe de puits',
    );
  });

  it('garde un marqueur tronqué en texte littéral plutôt que de le manger', () => {
    // ts_headline peut couper au milieu d'un marqueur en fin de fenêtre.
    expect(stripMarkers('facture <<Engie')).toBe('facture <<Engie');
  });

  it('traverse les retours à la ligne — les champs sont concaténés par \\n', () => {
    expect(parseSnippet('titre\n<<corps>>')).toEqual([
      { text: 'titre\n', match: false },
      { text: 'corps', match: true },
    ]);
  });

  it('ne renvoie rien pour un extrait vide', () => {
    expect(parseSnippet('')).toEqual([]);
  });

  it("laisse le HTML de l'utilisateur intact — il sera rendu comme du texte", () => {
    // Le contenu vient du foyer (OCR, note) : aucun échappement ici, donc aucun
    // rendu HTML côté composant.
    expect(parseSnippet('<script>alert(1)</script> <<devis>>')).toEqual([
      { text: '<script>alert(1)</script> ', match: false },
      { text: 'devis', match: true },
    ]);
  });
});
