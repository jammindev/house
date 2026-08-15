# Compte rendu — Parcours 30, module Verger

> **2026-08-15**, une session. Du cadrage à la livraison des huit lots.
> Doc produit : [PARCOURS_30_SUIVRE_LE_VERGER.md](../parcours/PARCOURS_30_SUIVRE_LE_VERGER.md) ·
> Fiche : [CADENCE_SAISONNIERE.md](../fiches/CADENCE_SAISONNIERE.md) ·
> Module : [orchard.md](../MODULES/orchard.md)

## 1. Ce qui a été livré

| Lot | Sujet | PR | Issue |
|---|---|---|---|
| 1+2 | Socle backend `apps/orchard` + services/API | #604 | #594, #595 |
| 3+4 | Frontend « Verger » + récoltes et séries | #605 | #596, #597 |
| 5 | Entretien saisonnier (`CareRule`, `seasons.py`) | #612 | #598 |
| 6+7+8 | Achat, gel × floraison, intégration agent | #613 | #599, #600, #601 |

Cadrage préalable : doc produit, fiche concept, backlog en 8 lots, glossaire des
user stories, issues #593 à #602 — commité avant la première ligne de code.

**Non livré** : le widget dashboard (ORCH-11). L'alerte gel remonte dans le
résumé d'alertes, mais aucune card ne l'affiche sur le tableau de bord.

## 2. Les décisions prises en cours de route

Celles qui n'étaient pas au cadrage et que le code a forcées.

### Une règle par type est un état **par sujet**

Le cadrage disait « une règle s'applique à un sujet ou à un `kind` ». À
l'implémentation, la question s'est posée : que veut dire « fait » pour une règle
qui vise les cinq pommiers ? Avoir taillé un pommier ne solde évidemment pas la
saison. `queries.rule_states` rend donc **une ligne par paire (règle, sujet)**.
Fondre les cinq en un drapeau unique aurait laissé quatre arbres non taillés
derrière une coche verte — c'est la même faute que le compteur de conformité à
zéro qui voulait dire deux choses.

### `CareRule.event_type` — le type d'entrée appartient à la règle

Non prévu. Une règle « bouillie bordelaise » qui écrit une entrée de type
`pruning` fait **mentir le filtre par type du journal**, qui est justement une des
raisons d'avoir un modèle dédié plutôt qu'une `Interaction`. Le champ a été ajouté
avant la première migration.

### On n'accuse pas une règle neuve d'avoir raté une saison

En écrivant `rule_status`, le cas est apparu : une règle créée en mai serait
immédiatement `missed` pour la fenêtre novembre → mars qui vient de se refermer.
Un reproche sur lequel personne ne peut agir. La fonction compare donc la date de
création de la règle à la fin de la fenêtre.

### `formatQuantity` plutôt qu'une rustine locale

La CI a refusé `toLocaleString()` sans locale (§ 3.4). Le réflexe aurait été de
passer `appLocale()` aux deux appels. Un helper a été ajouté à `lib/format.ts`
à la place, au motif qu'une quantité obéit à la même règle qu'un montant : elle
ne doit avoir **qu'un seul rendu**.

## 3. Les problèmes rencontrés, et comment ils ont été tranchés

### 3.1 La FK obligatoire faisait un 500 sur un geste banal

`Tree.zone` en `PROTECT` était une demande explicite du cadrage. Ce que le
cadrage n'avait pas vu : Django lève `ProtectedError`, que DRF ne traduit pas —
supprimer une zone du jardin aurait donc rendu un **500**.

**Tranché** : `ZoneViewSet.destroy` attrape l'exception et répond **409 en nommant
et comptant** ce qui bloque (« cette zone contient 2 sujets du verger »). Un refus
qui ne dit pas quoi déplacer oblige l'utilisateur à chercher.

**Découverte au passage** : le point de vigilance du backlog sur la suppression
**en cascade depuis une zone parente** était déjà neutralisé — `destroy` refuse
depuis toujours une zone qui a des enfants. Le test a quand même été écrit, pour
épingler le comportement le jour où cette règle-là s'assouplirait.

### 3.2 Le service posait un défaut que le serializer refusait avant lui

`occurred_on` et `harvested_on` sont obligatoires en base, avec pour défaut
« aujourd'hui **chez le foyer** » — que seul le service connaît, parce qu'il faut
le fuseau du foyer. Or le viewset valide **avant** d'appeler le service : le
serializer répondait 400 sur un payload parfaitement légitime.

**Tranché** : les deux champs sont `required=False` **sur le fil** et obligatoires
**en colonne**. Le contrat est explicite dans le code : le service possède le
défaut, le serializer ne le réclame pas.

### 3.3 La liste de l'API n'est pas paginée

Les premiers tests lisaient `response.data["results"]`, par analogie avec DRF
paginé. Le projet n'active **aucune pagination globale** : les listes sont des
tableaux nus. Corrigé dans les tests — et c'est une information utile, parce que
c'est aussi ce qui rend la pagination du module documents (#527) une dette
isolée et non une convention du dépôt.

### 3.4 `toLocaleString()` sans locale — attrapé par la CI, pas par moi

`ui/src/lib/locale.test.ts` interdit tout formatage qui lit la locale du
**navigateur** au lieu de celle de l'app. Deux de mes appels violaient la règle.
Je ne l'avais pas lancé en local : j'avais joué `keys.test.ts` et
`invalidate.test.ts`, pas la suite entière.

**Le défaut était réel** : un foyer en français sur un Chrome en anglais aurait lu
« 12.5 kg » sur un écran et « 12,5 kg » sur l'autre. **Leçon d'exécution** : lancer
`npx vitest run` en entier avant de pousser, pas seulement les garde-fous qu'on a
en tête.

### 3.5 Les onglets Documents et Photos affichaient TOUT — et je l'ai écrit faux

Le backlog prévoyait du travail au lot 6 pour les brancher. En lisant
`apps/documents/views.py`, j'ai vu la branche `?linked_to=<type>:<uuid>` qui
résout via `agent.searchables.find_spec`, et j'en ai conclu — **à tort** — que le
filtre par entité était générique. Les onglets ont donc été branchés en trois
lignes, et cette conclusion écrite dans la fiche du module.

**Elle était fausse.** Juste au-dessus, la liste des raccourcis par entité était
**écrite en dur** : `('zone', 'project', 'equipment', 'task', 'chicken')`. Le
front envoyait `?tree=<id>`, qui n'y figurait pas — et un paramètre inconnu
tombait dans un `continue`. Or **un filtre ignoré ne rend pas moins de documents,
il les rend tous** : l'onglet Documents d'un arbre affichait la photothèque
entière du foyer. C'est Ben qui l'a vu à l'usage, pas moi.

**Tranché** en trois temps :
1. la liste des raccourcis **dérive du registre** — elle ne peut plus prendre de
   retard sur `agent.searchables` ;
2. un type inconnu **refuse en 400** au lieu de retomber sur « pas de filtre ».
   Sur-partager en silence est pire que refuser — c'est exactement la règle déjà
   posée pour `?purpose=` : « un paramètre oublié ne doit pas pouvoir se lire
   comme un filtre » ;
3. les deux onglets génériques passent par `?linked_to=<type>:<id>`, forme sans
   risque de collision.

**Une collision découverte par le test au passage** : dériver la liste du registre
a fait rougir `?interaction=`, qui est déjà un `filterset_fields` sur la FK
`Document.interaction`. Un paramètre ne peut pas porter deux sens : ce type-là est
exclu des raccourcis, nommément et par constante documentée.

**La leçon, et elle vaut au-delà de ce bug** : j'ai lu une branche générique et
généralisé au fichier. Un mécanisme n'est générique que si on a vu **ce qui se
passe pour une valeur inconnue** — ici, un `continue` silencieux. Et je l'ai écrit
dans la doc comme un fait acquis, ce qui aurait propagé l'erreur.

Régression : `documents/tests/test_entity_filter.py`, dont un garde-fou dérivé du
registre qui rougira pour le **prochain** module, pas seulement pour le verger.

### 3.6 L'environnement E2E local était cassé — deux fois

- **L'état d'authentification recopié était périmé** : le worktree n'a pas de
  `e2e/.auth/user.json` (gitignoré), et celui du checkout principal portait un
  JWT expiré. Régénéré en ne jouant **que** l'étape `authenticate` du setup —
  `seed_demo_data --flush` reste cassé par ailleurs.
- **La base `house_e2e` avait perdu son utilisateur de démo.** `global.setup.ts`
  se connecte en `claire.mercier@demo.local` ; la base ne contenait plus qu'un
  `ben@exemple.fr`. Tous les appels API des specs répondaient
  `{"household_id":"A valid household_id is required."}` — un message qui ne
  désigne pas du tout la cause. Réparé en recréant l'utilisateur attendu avec son
  foyer.

Deux pièges de test à corriger ensuite, tous deux de ma faute :

- chaque spec **crée sa propre zone** et la supprime, parce que l'une d'elles
  vérifie justement qu'une zone occupée refuse d'être supprimée : réutiliser la
  zone de démo faisait tomber les suivantes ;
- un sélecteur d'onglet ancré (`/^récoltes$/`) ne matche plus dès que l'onglet
  porte un **badge de comptage**. Le test passait à zéro récolte et échouait à
  deux.

Enfin, à force de rejouer la suite, le **throttle global** (240 req/min) a
répondu 429. Ce n'est pas un défaut : c'est le plancher `core.throttles` qui fait
son travail.

## 4. Ce qui a été volontairement laissé de côté

- **Le widget dashboard** (ORCH-11) — non livré. L'alerte gel remonte dans le
  résumé, ce qui la rend visible ; la card est du confort.
- **Les E2E des lots 6, 7 et 8.** Cinq user stories (ORCH-08 à ORCH-13) sont
  livrées et couvertes par des tests Python, mais sans spec Playwright. Elles sont
  marquées **🚧** dans `docs/USER_STORIES.md`, jamais ✅ : le tableau dit ce qui
  est prouvé, pas ce qu'on croit avoir fait.
- **Le crédit d'une récolte au stock** — différé au cadrage (conversion d'unités,
  idempotence de la suppression).
- ~~**Les tutoriels** (`/tutorials`)~~ — **rattrapé** : le guide « Verger » (six
  étapes) a été ajouté après la livraison, sur signalement de Ben. C'était une
  dette explicite de la définition de done, et elle n'aurait pas dû sortir de la
  session sans être payée.

## 5. Ce que l'exécution a confirmé du cadrage

Deux paris du cadrage se sont vérifiés à l'usage :

- **La fenêtre à cheval sur deux années est bien le cas normal.** Le défaut
  proposé par le formulaire est « novembre → mars », et les treize tests de
  `seasons.py` portent d'abord sur ce cas. Une suite qui n'aurait testé que
  « juin → août » aurait été verte avec le bug dedans.
- **Le journal dédié était le bon choix**, mais pour une raison plus concrète que
  prévu : `rule_states` fait un `GROUP BY (care_rule, tree)` avec un `Max`. Ce
  n'est pas seulement « interdit depuis `metadata` », c'est **impossible à écrire**
  proprement.

Un pari reste ouvert : la contrepartie assumée — le verger n'apparaît pas dans le
fil d'activité du foyer, comme le poulailler. C'est le sujet transverse #509, et
il concerne maintenant **deux** modules, ce qui le rend plus urgent qu'avant.
