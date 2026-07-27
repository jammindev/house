import { describe, expect, it } from 'vitest';

/**
 * Le garde-fou i18n : toute clé appelée existe, dans les quatre langues.
 *
 * Ce test existe à cause d'une régression qui a vécu en production. Le dialogue
 * « dépense en espèces » a réutilisé le namespace `banking.cash.*` et **écrasé**
 * les clés du dialogue « retirer vers les espèces » : douze clés disparues d'un
 * coup, dont le libellé d'un bouton présent sur chaque ligne sortante du
 * journal, qui affichait donc littéralement `banking.cash.action`.
 *
 * Rien ne l'a signalé, et les deux garde-fous existants ont chacun regardé à
 * côté :
 *
 * - la règle « jamais de `defaultValue` » (CLAUDE.md) fait afficher la clé brute
 *   au lieu d'un texte anglais — encore faut-il que quelqu'un ouvre l'écran ;
 * - la parité entre catalogues était **verte**, parce que la clé manquait
 *   partout. Comparer les langues entre elles ne voit pas ce trou-là.
 *
 * D'où les deux assertions : le **code** contre le français, puis les trois
 * autres langues contre le français.
 */

const LANGUAGES = ['en', 'de', 'es'] as const;

/** Les clés `t('…')` littérales. Une clé construite n'est pas vérifiable ici. */
const CALL = /\bt\(\s*['"]([a-zA-Z0-9_.-]+)['"]/g;

const catalogues = import.meta.glob<Record<string, unknown>>('./*/translation.json', {
  eager: true,
  import: 'default',
});

/**
 * Namespaces couverts. Volontairement une liste, pas « tout le front » :
 * `features/settings` traîne une trentaine de `t(…, { defaultValue })` hérités
 * qui violent déjà la règle du projet, et faire échouer ce test dessus le ferait
 * désactiver au lieu d'être lu. Élargir au fur et à mesure qu'ils sont résorbés.
 */
const sources = import.meta.glob<string>(
  '../features/{money,banking,budget,expenses,interactions}/**/*.{ts,tsx}',
  { eager: true, query: '?raw', import: 'default' },
);

function flatten(node: unknown, prefix = '', out = new Set<string>()): Set<string> {
  if (node && typeof node === 'object' && !Array.isArray(node)) {
    for (const [key, value] of Object.entries(node as Record<string, unknown>)) {
      flatten(value, prefix ? `${prefix}.${key}` : key, out);
    }
  } else {
    out.add(prefix);
  }
  return out;
}

function catalogue(language: string): Set<string> {
  const found = catalogues[`./${language}/translation.json`];
  if (!found) throw new Error(`catalogue introuvable : ${language}`);
  return flatten(found);
}

/** i18next résout `foo` via `foo_one` / `foo_other` : une clé pluralisée compte. */
function isKnown(key: string, keys: Set<string>): boolean {
  if (keys.has(key)) return true;
  for (const candidate of keys) {
    if (candidate.startsWith(`${key}_`)) return true;
  }
  return false;
}

describe('catalogues de traduction', () => {
  const french = catalogue('fr');

  it('toute clé appelée par le module Argent existe en français', () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      for (const match of source.matchAll(CALL)) {
        if (!isKnown(match[1], french)) missing.push(`${match[1]} → ${file}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it('les fichiers du module Argent sont bien lus (le test ne teste pas le vide)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(30);
  });

  it.each(LANGUAGES)('le catalogue %s a exactement les mêmes clés que le français', (language) => {
    const other = catalogue(language);
    expect([...french].filter((key) => !other.has(key)).sort()).toEqual([]);
    expect([...other].filter((key) => !french.has(key)).sort()).toEqual([]);
  });
});
