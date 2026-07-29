import { describe, expect, it } from 'vitest';
import { QUERY_ROOTS, rootsInvalidatedBy, type QueryRoot } from './invalidate';

/**
 * Les deux garde-fous de la fraîcheur des données.
 *
 * Le symptôme corrigé : « j'édite le fournisseur d'une dépense, je reviens, et
 * je dois recharger la page pour voir mon changement ». Il n'était pas isolé —
 * dix composants écrivaient par l'API sans passer par un hook (donc sans
 * toucher un seul cache), et trois racines dérivées (`dashboard`, `alerts`,
 * `projects` vu depuis l'argent) n'étaient invalidées par personne.
 *
 * Ce défaut a deux propriétés qui le rendent récurrent, et c'est pourquoi il
 * demande un test plutôt qu'une relecture :
 *
 * 1. **il est invisible en revue** — le diff d'un `onSuccess` qui oublie une
 *    racine ressemble exactement à celui qui la liste ;
 * 2. **il est invisible en développement** — Vite recharge le module, donc le
 *    cache, à chaque sauvegarde : l'écran qu'on vient d'écrire est toujours
 *    frais chez celui qui l'écrit.
 *
 * D'où le contrôle statique : le premier test tient la **discipline** (aucune
 * écriture hors d'un hook), le second tient le **graphe** (ce qui dérive d'une
 * racine se rafraîchit avec elle).
 */

/** Tout le front — pas une liste de dossiers choisis. */
const sources = import.meta.glob<string>('../{features,components,lib,pages,design-system}/**/*.{ts,tsx}', {
  eager: true,
  query: '?raw',
  import: 'default',
});

const apiModules = import.meta.glob<string>('../lib/api/*.ts', {
  eager: true,
  query: '?raw',
  import: 'default',
});

/**
 * Ce qui compte comme une écriture, par son préfixe.
 *
 * `send*` en est exclu à dessein : `sendTestWebPush` / `sendBriefingNow`
 * déclenchent un envoi, ils ne changent aucune donnée lue par un écran.
 */
const WRITE_PREFIX =
  /^(create|update|delete|patch|remove|add|set|link|unlink|upload|import|confirm|toggle|mark|attach|detach|archive|restore|bulk|reconcile|move|revoke|reprocess)[A-Z]/;

/**
 * Les fichiers autorisés à importer une écriture.
 *
 * La règle est « les mutations vivent dans le `hooks.ts` de leur feature » :
 * c'est le seul endroit où l'invalidation se déclare une fois pour tous les
 * appelants. Un composant qui appelle l'API en direct doit re-déclarer cette
 * invalidation, et c'est ce doublon qui a dérivé dix fois.
 */
function isAllowed(file: string): boolean {
  if (file.endsWith('/hooks.ts')) return true;
  if (file.includes('/lib/api/')) return true;
  if (file.endsWith('.test.ts') || file.endsWith('.test.tsx')) return true;
  // Registry des modules — porte ses propres hooks (`useToggleModule`), pas un
  // composant : le `patchMe` y est déjà encadré par son invalidation.
  if (file.endsWith('/modules.ts')) return true;
  return false;
}

function writeFunctions(): Set<string> {
  const names = new Set<string>();
  for (const source of Object.values(apiModules)) {
    for (const match of source.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
      if (WRITE_PREFIX.test(match[1])) names.add(match[1]);
    }
  }
  return names;
}

/** Les noms importés depuis `@/lib/api/…` par un fichier. */
function importedFromApi(source: string): string[] {
  const names: string[] = [];
  for (const match of source.matchAll(/import\s+(?:type\s+)?\{([^}]*)\}\s+from\s+'@\/lib\/api\/[^']*'/gs)) {
    for (const part of match[1].split(',')) {
      const name = part.trim().split(/\s+as\s+/)[0].trim();
      if (name && !name.startsWith('type ')) names.push(name);
    }
  }
  return names;
}

describe('les écritures passent par un hook', () => {
  const writes = writeFunctions();

  it('le test lit bien tout le front et toute la couche API', () => {
    expect(Object.keys(sources).length).toBeGreaterThan(300);
    expect(writes.size).toBeGreaterThan(80);
  });

  it("aucun composant n'appelle l'API d'écriture en direct", () => {
    const offenders: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (isAllowed(file)) continue;
      const direct = importedFromApi(source).filter((name) => writes.has(name));
      if (direct.length > 0) offenders.push(`${file} → ${direct.sort().join(', ')}`);
    }
    expect(offenders.sort()).toEqual([]);
  });
});

describe('le graphe des caches', () => {
  it('une écriture invalide toujours sa propre racine', () => {
    for (const root of QUERY_ROOTS) {
      expect(rootsInvalidatedBy(root)).toContain(root);
    }
  });

  /**
   * Les trois trous constatés en production, un cas chacun. Ce ne sont pas des
   * exemples : ce sont les régressions.
   */
  it('le dashboard se rafraîchit après une tâche, une interaction ou un projet', () => {
    expect(rootsInvalidatedBy('tasks')).toContain('dashboard');
    expect(rootsInvalidatedBy('interactions')).toContain('dashboard');
    expect(rootsInvalidatedBy('projects')).toContain('dashboard');
  });

  it('la pastille d’alertes se rafraîchit après une tâche, un équipement, un stock', () => {
    expect(rootsInvalidatedBy('tasks')).toContain('alerts');
    expect(rootsInvalidatedBy('equipment')).toContain('alerts');
    expect(rootsInvalidatedBy('stock')).toContain('alerts');
  });

  it('le coût d’un projet se rafraîchit après une dépense', () => {
    expect(rootsInvalidatedBy('interactions')).toContain('projects');
  });

  /**
   * La dérivation se chaîne, donc la fermeture doit être transitive : ventiler
   * une ligne bancaire crée des dépenses, qui changent le coût d'un projet, qui
   * s'affiche sur le dashboard. Un seul saut s'arrêtait aux dépenses.
   */
  it('la fermeture est transitive — une ligne bancaire va jusqu’au dashboard', () => {
    const stale = rootsInvalidatedBy('banking');
    expect(stale).toContain('projects');
    expect(stale).toContain('dashboard');
  });

  it("l'argent reste une seule donnée à cinq caches", () => {
    const money: QueryRoot[] = ['banking', 'interactions', 'expenses', 'budget', 'compliance'];
    for (const written of money) {
      for (const stale of money) {
        expect(rootsInvalidatedBy(written)).toContain(stale);
      }
    }
  });

  it('un cycle déclaré ne boucle pas (photos ↔ documents)', () => {
    expect(rootsInvalidatedBy('photos')).toContain('documents');
    expect(rootsInvalidatedBy('documents')).toContain('photos');
  });
});
