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
 * Ce qui compte comme une écriture — **détecté sur l'implémentation**, jamais
 * sur le nom.
 *
 * Première version de ce test : une liste de préfixes (`create*`, `update*`,
 * `set*`…). Elle ratait **trente-trois** fonctions, dont la totalité des
 * écritures de l'argent — `recordCashExpense`, `creditBudgetFromRefund`,
 * `qualifyTransaction`, `withdrawToCash`, `registerProjectPurchase`,
 * `purchaseStockItem`, `logEggs`, `adjustStockQuantity`… Un garde-fou qui
 * dépend d'une convention de nommage protège ce dont on s'est souvenu en
 * l'écrivant, c'est-à-dire précisément pas les cas oubliés : `recordCashExpense`
 * n'a jamais eu l'air d'une écriture, et c'en est une.
 *
 * Le verbe HTTP, lui, ne s'oublie pas — on ne poste pas par distraction.
 */
const MUTATING_CALL = /\bapi\.(post|patch|put|delete)\b|\b(post|patch|put)Multipart\b/;

/**
 * Une déclaration de fonction, de sa signature à l'accolade qui la ferme en
 * colonne 0.
 *
 * ⚠️ `^\}$` et pas `^\}` : une signature dont le paramètre est un objet inline
 * (`function f(params: {`) porte un `}` en colonne 0 **au milieu** de sa propre
 * signature. Avec `^\}`, le corps d'`importStatementFile` s'arrêtait là et son
 * `postMultipart` passait inaperçu.
 */
const FUNCTION_DECLARATION = /^(export )?(?:async )?function (\w+)[\s\S]*?^\}$/gm;

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

/**
 * Les deux écritures qui n'ont **rien à invalider**, et pourquoi.
 *
 * Une exception se justifie par un fait vérifiable, pas par une préférence —
 * sinon cette liste devient l'endroit où l'on range ce qu'on ne veut pas
 * corriger.
 */
const NOTHING_TO_INVALIDATE: Record<string, string> = {
  // Rejoindre un foyer se termine par `window.location.assign('/app/dashboard')`
  // — un chargement complet, qui jette le cache entier. Un hook n'aurait rien à
  // périmer, et le foyer change de sous les pieds de toutes les clés à la fois.
  joinHousehold: 'features/auth/JoinHouseholdPage.tsx — suivi d’un rechargement complet',
  // L'abonnement push vit dans le navigateur (permission + `PushSubscription`),
  // pas dans une requête en cache : la seule `useQuery` de l'écran lit la clé
  // VAPID, qui est de la configuration statique.
  subscribeWebPush: 'features/settings/components/WebPushSection.tsx — état navigateur, aucun cache lecteur',
  unsubscribeWebPush: 'features/settings/components/WebPushSection.tsx — idem',
  sendTestWebPush: 'features/settings/components/WebPushSection.tsx — un envoi, aucune donnée changée',
};

function writeFunctions(): Set<string> {
  const bodies = new Map<string, string>();
  const exported = new Set<string>();
  for (const source of Object.values(apiModules)) {
    for (const match of source.matchAll(FUNCTION_DECLARATION)) {
      bodies.set(match[2], match[0]);
      if (match[1]) exported.add(match[2]);
    }
  }

  const writes = new Set<string>();
  for (const [name, body] of bodies) {
    if (MUTATING_CALL.test(body)) writes.add(name);
  }

  // Point fixe : **déléguer à une écriture est écrire.** `restoreBankAccount`
  // ne poste rien lui-même, il appelle `updateBankAccount` — et il en a tous
  // les effets. Même chose pour les helpers non exportés du module.
  let grew = true;
  while (grew) {
    grew = false;
    for (const [name, body] of bodies) {
      if (writes.has(name)) continue;
      for (const write of writes) {
        // `[<(]` : capter aussi un appel générique — `postMultipart<Foo>(…)`.
        if (new RegExp(`\\b${write}\\s*[<(]`).test(body)) {
          writes.add(name);
          grew = true;
          break;
        }
      }
    }
  }

  return new Set([...writes].filter((name) => exported.has(name)));
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
    // 173 au moment d'écrire ces lignes. Le plancher est là pour attraper une
    // détection qui retomberait à vide (regex cassée, glob qui ne matche plus) —
    // un test qui ne teste rien passe, et c'est le pire des deux mondes.
    expect(writes.size).toBeGreaterThan(150);
  });

  it('les écritures se reconnaissent par leur verbe HTTP, pas par leur nom', () => {
    // Les cas que la détection par préfixe ratait : aucun ne « ressemble » à une
    // écriture, tous en sont une.
    for (const name of [
      'recordCashExpense',
      'creditBudgetFromRefund',
      'qualifyTransaction',
      'withdrawToCash',
      'registerProjectPurchase',
      'purchaseStockItem',
      'logEggs',
      'importStatementFile', // via `postMultipart`
      'restoreBankAccount', // via `updateBankAccount`
    ]) {
      expect(writes, name).toContain(name);
    }
    // Et une lecture reste une lecture.
    expect(writes).not.toContain('fetchInteractions');
  });

  it("aucun composant n'appelle l'API d'écriture en direct", () => {
    const offenders: string[] = [];
    for (const [file, source] of Object.entries(sources)) {
      if (isAllowed(file)) continue;
      const direct = importedFromApi(source)
        .filter((name) => writes.has(name))
        .filter((name) => !(name in NOTHING_TO_INVALIDATE));
      if (direct.length > 0) offenders.push(`${file} → ${direct.sort().join(', ')}`);
    }
    expect(offenders.sort()).toEqual([]);
  });

  it('la liste des exceptions ne survit pas à ce qu’elle nomme', () => {
    // Une exception qui désigne une fonction disparue est un commentaire faux
    // qu'aucune relecture ne remarquera.
    for (const name of Object.keys(NOTHING_TO_INVALIDATE)) {
      expect(writes, `${name} n'est plus une écriture`).toContain(name);
    }
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

  it('la pastille d’alertes se rafraîchit après une corvée du poulailler', () => {
    // Cocher « nettoyé » repousse l'échéance, donc retire l'alerte de retard.
    // Sans cette arête, la pastille reste rouge sur une corvée déjà faite.
    expect(rootsInvalidatedBy('chickens')).toContain('alerts');
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
