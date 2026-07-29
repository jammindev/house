import { describe, it, expect } from 'vitest';
import { decimalSeparator, parseDecimalInput, toDecimalDisplay } from './format';

/**
 * Régression #448 — la virgule du clavier français dans un champ décimal.
 *
 * `<input type="number">` n'accepte que le point : le HTML impose au `value`
 * d'être un *valid floating-point number*, jamais un décimal localisé. Taper
 * `12,5` produisait `512` sur Chromium et `5` sur Safari/Firefox — une valeur
 * fausse, sans message.
 *
 * La lecture d'une frappe est donc **indépendante de la locale** : les deux
 * séparateurs sont toujours acceptés (un français sur un navigateur anglais tape
 * une virgule ; un pavé numérique et un copier-coller donnent un point).
 */
describe('parseDecimalInput — la frappe devient une valeur canonique', () => {
  it('accepte la virgule et rend un décimal à point, prêt pour l\'API', () => {
    expect(parseDecimalInput('12,5')).toBe('12.5');
  });

  it('accepte aussi le point — pavé numérique, copier-coller', () => {
    expect(parseDecimalInput('12.5')).toBe('12.5');
  });

  it('laisse passer la frappe intermédiaire sans jamais produire un décimal invalide', () => {
    // « 12, » est une frappe légitime en cours ; « 12. » ne doit pas partir tel
    // quel vers l'API, donc le séparateur en attente est retiré de la valeur.
    expect(parseDecimalInput('12,')).toBe('12');
    expect(parseDecimalInput('12.')).toBe('12');
    expect(parseDecimalInput(',')).toBe('');
    expect(parseDecimalInput('-', { allowNegative: true })).toBe('');
    expect(parseDecimalInput('')).toBe('');
  });

  it('complète le séparateur de tête — « ,5 » vaut cinquante centimes', () => {
    expect(parseDecimalInput(',5')).toBe('0.5');
    expect(parseDecimalInput('.5')).toBe('0.5');
  });

  it('ignore les espaces de groupement d\'un montant collé', () => {
    expect(parseDecimalInput('1 234,56')).toBe('1234.56');
    expect(parseDecimalInput('1 234,56')).toBe('1234.56');
    expect(parseDecimalInput('1 234,56')).toBe('1234.56');
  });

  it('refuse ce qui n\'est pas un décimal — la frappe est alors ignorée', () => {
    expect(parseDecimalInput('12€')).toBeNull();
    expect(parseDecimalInput('abc')).toBeNull();
    expect(parseDecimalInput('12,5,5')).toBeNull();
    expect(parseDecimalInput('1.234,56')).toBeNull();
  });

  it('borne les décimales — deux pour un montant, cinq pour un tarif', () => {
    expect(parseDecimalInput('12,555')).toBeNull();
    expect(parseDecimalInput('12,555', { decimals: 3 })).toBe('12.555');
    expect(parseDecimalInput('0,12345', { decimals: 5 })).toBe('0.12345');
  });

  it('refuse le signe moins sauf là où un solde peut être négatif', () => {
    expect(parseDecimalInput('-12,5')).toBeNull();
    expect(parseDecimalInput('-12,5', { allowNegative: true })).toBe('-12.5');
  });
});

describe('toDecimalDisplay — la valeur canonique se relit dans la locale', () => {
  it('affiche la virgule en français, le point en anglais', () => {
    expect(toDecimalDisplay('12.50', 'fr-FR')).toBe('12,50');
    expect(toDecimalDisplay('12.50', 'en-US')).toBe('12.50');
  });

  it('ne groupe jamais les milliers — un séparateur de groupe casse l\'édition', () => {
    expect(toDecimalDisplay('1234.56', 'fr-FR')).toBe('1234,56');
  });

  it('rend le vide et le non-numérique tels quels', () => {
    expect(toDecimalDisplay('', 'fr-FR')).toBe('');
    expect(toDecimalDisplay('abc', 'fr-FR')).toBe('abc');
  });

  it('fait l\'aller-retour avec parseDecimalInput dans la locale de lecture', () => {
    const typed = `12${decimalSeparator()}5`;
    expect(toDecimalDisplay(parseDecimalInput(typed) ?? '')).toBe(typed);
  });
});

describe('decimalSeparator', () => {
  it('lit le séparateur de la locale, comme formatAmount lit la devise', () => {
    expect(decimalSeparator('fr-FR')).toBe(',');
    expect(decimalSeparator('en-US')).toBe('.');
    expect(decimalSeparator('de-DE')).toBe(',');
  });
});
