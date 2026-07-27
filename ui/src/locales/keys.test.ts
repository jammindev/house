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

/**
 * `defaultValue` dans un `t()` — interdit par le CLAUDE.md.
 *
 * C'est la contrepartie du test ci-dessus, et elle est indispensable : un
 * `defaultValue` rend une clé manquante **indétectable**, puisque l'écran affiche
 * un texte anglais plausible au lieu de la clé brute. Les 111 occurrences
 * historiques masquaient trois vrais défauts — un titre de dialogue réduit à
 * « Créer », deux échecs distincts fondus en « Échec de la requête », et une
 * `<legend>` qui affichait `tagSelector.legend`.
 *
 * ⚠️ Le motif ne cherche pas `t(`, seulement la propriété : un `defaultValue`
 * réparti sur plusieurs lignes échapperait à une détection par appel.
 */
const DEFAULT_VALUE = /\bdefaultValue\s*:/;

const catalogues = import.meta.glob<Record<string, unknown>>('./*/translation.json', {
  eager: true,
  import: 'default',
});

/** Tout le front — pas une liste de namespaces choisis. */
const sources = import.meta.glob<string>('../{features,components,lib}/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * `useSessionState(key, defaultValue)` porte ce nom pour son propre paramètre :
 * ce n'est pas un `t()`, et le nom est le bon là où il est.
 */
const DEFAULT_VALUE_ALLOWED = ['../lib/useSessionState.ts'];

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

  it('toute clé appelée par le front existe en français', () => {
    const missing: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      for (const match of source.matchAll(CALL)) {
        if (!isKnown(match[1], french)) missing.push(`${match[1]} → ${file}`);
      }
    }
    expect(missing).toEqual([]);
  });

  it("aucun t() ne porte de defaultValue — il masquerait la clé qu'il remplace", () => {
    const offenders: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) continue;
      if (DEFAULT_VALUE_ALLOWED.includes(file)) continue;
      if (DEFAULT_VALUE.test(source)) offenders.push(file);
    }
    expect(offenders).toEqual([]);
  });

  it('le front est bien lu en entier (le test ne teste pas le vide)', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(300);
  });

  it.each(LANGUAGES)('le catalogue %s a exactement les mêmes clés que le français', (language) => {
    const other = catalogue(language);
    expect([...french].filter((key) => !other.has(key)).sort()).toEqual([]);
    expect([...other].filter((key) => !french.has(key)).sort()).toEqual([]);
  });
});
