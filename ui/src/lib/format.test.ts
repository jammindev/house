import { afterEach, describe, expect, it } from 'vitest';

import i18n from './i18n';
import {
  decimalSeparator,
  formatAmount,
  formatDate,
  formatDateTime,
  formatMonthKey,
  formatMonthYear,
  toDecimalDisplay,
} from './format';

/**
 * L'app a le droit d'afficher une langue que le navigateur n'a pas.
 *
 * La langue vient de la préférence du compte (`/accounts/me/.locale`, appliquée
 * par `AuthProvider`), puis de `localStorage.lang`, et seulement en dernier
 * recours de `navigator.language`. Un `Intl.*Format(undefined, …)` lit, lui,
 * **toujours** la locale du runtime — celle du navigateur. Tant que les deux
 * coïncident le défaut est invisible ; dès qu'ils divergent l'app rend une
 * interface française avec des dates américaines (« Aug 13, 2026 »).
 *
 * Ces tests ne prouvent quelque chose que parce que la locale ambiante du
 * runtime n'est **pas** celle qu'on demande — le premier cas le vérifie, sans
 * quoi les suivants passeraient sur un formatteur resté cassé.
 */
describe('les formatteurs suivent la langue de l’app, pas celle du navigateur', () => {
  const original = i18n.language;

  afterEach(async () => {
    await i18n.changeLanguage(original);
  });

  it('la locale ambiante diffère du français, sinon ce fichier ne teste rien', () => {
    const ambient = new Intl.DateTimeFormat().resolvedOptions().locale;
    expect(ambient.startsWith('fr')).toBe(false);
  });

  it('une date commence par le jour en français, par le mois en anglais', async () => {
    await i18n.changeLanguage('fr');
    expect(formatDate('2026-08-13T10:00:00Z')).toBe('13 août 2026');

    await i18n.changeLanguage('en');
    expect(formatDate('2026-08-13T10:00:00Z')).toBe('Aug 13, 2026');
  });

  it('une date + heure suit la même langue', async () => {
    await i18n.changeLanguage('fr');
    expect(formatDateTime('2026-08-13T10:00:00Z')).toContain('13 août 2026');

    await i18n.changeLanguage('de');
    expect(formatDateTime('2026-08-13T10:00:00Z')).toContain('13.08.2026');
  });

  it('un montant porte le séparateur et la place du symbole de la langue lue', async () => {
    await i18n.changeLanguage('fr');
    // Espace fine insécable (U+202F) devant « € » : c'est ce que produit Intl en fr.
    expect(formatAmount('1234.50').replace(/\s/g, ' ')).toBe('1 234,50 €');

    await i18n.changeLanguage('en');
    expect(formatAmount('1234.50')).toBe('€1,234.50');
  });

  it('un mois en toutes lettres est écrit dans la langue de l’app', async () => {
    await i18n.changeLanguage('fr');
    expect(formatMonthYear('2026-08-13T10:00:00Z')).toBe('août 2026');
    expect(formatMonthKey('2026-08')).toBe('août 2026');

    await i18n.changeLanguage('es');
    expect(formatMonthKey('2026-08')).toBe('agosto de 2026');
  });

  /**
   * Le séparateur décimal de saisie doit venir de la **même** source que celui
   * de l'affichage : sinon `DecimalInput` propose une virgule pendant que
   * `formatAmount` réaffiche un point, et le même nombre se lit de deux façons
   * sur le même écran.
   */
  it('le séparateur de saisie est celui du montant réaffiché', async () => {
    await i18n.changeLanguage('fr');
    expect(decimalSeparator()).toBe(',');
    expect(toDecimalDisplay('12.5')).toBe('12,5');
    expect(formatAmount('12.5')).toContain('12,50');

    await i18n.changeLanguage('en');
    expect(decimalSeparator()).toBe('.');
    expect(toDecimalDisplay('12.5')).toBe('12.5');
    expect(formatAmount('12.5')).toContain('12.50');
  });
});
