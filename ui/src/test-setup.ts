import '@testing-library/jest-dom';

/**
 * Un `localStorage` utilisable dans les tests.
 *
 * Node ≥ 22 expose un `globalThis.localStorage` natif qui **masque** celui de
 * jsdom et reste inerte sans `--localstorage-file` : `getItem` y vaut
 * `undefined`, donc tout module qui lit une préférence au chargement (`lib/i18n`
 * et sa détection de langue) explose à l'import, avant même le premier test.
 * On réinstalle donc une implémentation mémoire, remise à plat par fichier de
 * test comme le serait un onglet neuf.
 */
function createMemoryStorage(): Storage {
  let entries = new Map<string, string>();
  return {
    get length() {
      return entries.size;
    },
    clear: () => {
      entries = new Map();
    },
    getItem: (key: string) => entries.get(key) ?? null,
    key: (index: number) => [...entries.keys()][index] ?? null,
    removeItem: (key: string) => {
      entries.delete(key);
    },
    setItem: (key: string, value: string) => {
      entries.set(key, String(value));
    },
  };
}

for (const target of [globalThis, window]) {
  Object.defineProperty(target, 'localStorage', {
    configurable: true,
    writable: true,
    value: createMemoryStorage(),
  });
}
