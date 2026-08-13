import { describe, expect, it } from 'vitest';

/**
 * Le garde-fou de la locale : aucun formatage ne lit celle du navigateur.
 *
 * L'app choisit sa langue **avant** de regarder le navigateur : préférence du
 * compte (`/accounts/me/.locale`, appliquée par `AuthProvider`), puis
 * `localStorage.lang`, et seulement en dernier recours `navigator.language`.
 * Un `Intl.DateTimeFormat(undefined, …)` ou un `toLocaleDateString()` nu lit,
 * lui, **toujours** la locale du runtime. Les deux définitions coïncident chez
 * qui a un navigateur français — et divergent chez tous les autres, qui lisent
 * une interface française datée « Aug 13, 2026 » et facturée « €1,234.50 ».
 *
 * C'est la même règle que « un compteur ne peut pas avoir deux définitions »,
 * appliquée à la langue : celle qui écrit les mots doit écrire les nombres.
 *
 * Et c'est un défaut qui ne se voit pas en revue — le diff d'un
 * `Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })` ressemble
 * exactement à celui qui est juste — ni chez qui l'écrit, dont le navigateur
 * est le plus souvent déjà dans la bonne langue. D'où un test, et non une
 * relecture.
 *
 * La réparation passe par `appLocale()` de `lib/format.ts`, ou par les
 * formatteurs partagés qui l'utilisent déjà.
 */

/** Tout le front — pas une liste de fichiers choisis. */
const sources = import.meta.glob<string>('../{features,components,lib,design-system}/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * `Intl.…Format(undefined, …)` — la locale par défaut du runtime, écrite
 * explicitement. `Collator` est hors périmètre : il trie, il n'affiche pas.
 */
const INTL_WITHOUT_LOCALE = /\bIntl\.(DateTimeFormat|NumberFormat|RelativeTimeFormat)\(\s*undefined\b/;

/**
 * `toLocaleDateString()` / `toLocaleString(undefined, …)` et leurs variantes —
 * même défaut, écrit plus court.
 *
 * `Intl.DateTimeFormat()` sans argument **du tout** n'est pas visé : le seul
 * usage du dépôt (`MeterDialog`) lit `resolvedOptions().timeZone`, et c'est
 * bien le fuseau du navigateur qu'on veut là.
 */
const TO_LOCALE_WITHOUT_LOCALE = /\.toLocale(?:Date|Time)?String\(\s*(?:undefined\b|\))/;

/** `lib/format.ts` définit `appLocale()` ; ses tests s'en servent pour comparer. */
const ALLOWED = ['../lib/format.ts', '../lib/format.test.ts', '../lib/locale.test.ts'];

function offenders(pattern: RegExp): string[] {
  const found: string[] = [];
  for (const [path, source] of Object.entries(sources)) {
    if (ALLOWED.includes(path)) continue;
    source.split('\n').forEach((line, index) => {
      if (pattern.test(line)) found.push(`${path}:${index + 1} — ${line.trim()}`);
    });
  }
  return found;
}

describe('aucun formatage ne lit la locale du navigateur', () => {
  it('aucun `Intl.*Format(undefined, …)` dans le front', () => {
    expect(offenders(INTL_WITHOUT_LOCALE)).toEqual([]);
  });

  it('aucun `toLocaleDateString()` sans locale dans le front', () => {
    expect(offenders(TO_LOCALE_WITHOUT_LOCALE)).toEqual([]);
  });

  it('le garde-fou attrape bien ce qu’il prétend attraper', () => {
    expect(INTL_WITHOUT_LOCALE.test("new Intl.DateTimeFormat(undefined, { dateStyle: 'medium' })")).toBe(true);
    expect(INTL_WITHOUT_LOCALE.test('new Intl.NumberFormat(undefined, {})')).toBe(true);
    expect(INTL_WITHOUT_LOCALE.test('new Intl.DateTimeFormat(appLocale(), {})')).toBe(false);
    expect(INTL_WITHOUT_LOCALE.test("new Intl.Collator(undefined, { sensitivity: 'base' })")).toBe(false);

    expect(TO_LOCALE_WITHOUT_LOCALE.test('date.toLocaleDateString()')).toBe(true);
    expect(TO_LOCALE_WITHOUT_LOCALE.test('n.toLocaleString(undefined, { maximumFractionDigits: 1 })')).toBe(true);
    expect(TO_LOCALE_WITHOUT_LOCALE.test('date.toLocaleDateString(appLocale())')).toBe(false);
    expect(TO_LOCALE_WITHOUT_LOCALE.test('Intl.DateTimeFormat().resolvedOptions().timeZone')).toBe(false);
  });
});
