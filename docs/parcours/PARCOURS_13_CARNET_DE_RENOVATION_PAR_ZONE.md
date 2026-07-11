# Parcours 13 — Garder la mémoire de ce qui a été rénové, pièce par pièce

> Cadré le 2026-07-11 avec l'utilisateur (session `/po`). Réutilise intégralement
> le socle `Interaction` (aucun nouveau modèle). Issues : **#239** (backend),
> **#240** (frontend), **#241** (agent). Backlog technique dans ce même fichier.

## Résumé

Le treizième usage fondamental du produit :

« Je viens de rénover la chambre de ma fille — je veux garder une trace de ce qui
a été fait : la peinture refaite avec telle peinture, le sol posé avec tel sol.
Et quand j'ai changé toutes les menuiseries de la maison, je veux pouvoir le noter
une seule fois pour toutes les pièces concernées. »

Aujourd'hui, quand un membre du foyer fait des travaux, l'information de **finition
durable** (quel produit, quelle marque, quelle référence) se perd : elle vit dans
la tête ou sur une facture au fond d'un tiroir. Six mois plus tard, quand il faut
racheter le même pot de peinture ou retrouver la référence du parquet pour une
réparation, l'info a disparu.

Ce parcours ouvre un **carnet de rénovation par zone** : une lecture et deux points
d'entrée d'écriture posés au-dessus des `Interaction` existantes, sans toucher à
leur représentation.

## Positionnement produit

- Parcours 01 — Capturer un événement (l'`Interaction` est le socle)
- Parcours 04 — Suivre un projet (un projet de rénovation *pilote* des travaux)
- Parcours 05 — Naviguer par zone (l'historique d'une zone)
- Parcours 08 — Voir ses dépenses (même socle `Interaction`, autre lecture)
- **Parcours 13** — Se souvenir *durablement* de ce qui a été rénové/décoré, par pièce

La différence avec le parcours 04 (projet) : un projet est un **chantier en cours**
avec un budget et une fin. Le carnet de rénovation est une **mémoire de référence**
qui survit au projet — « de quoi est faite cette pièce aujourd'hui ». Les deux se
complètent : un projet « Rénovation chambre » peut produire des entrées de carnet.

## Concept interne — aucune nouvelle source de vérité

On capitalise sur ce qui existe déjà :

- `Interaction` avec ses types `installation` / `replacement` / `upgrade` / `repair`
  / `maintenance` — déjà présents dans `INTERACTION_TYPES`.
- Le M2M `Interaction.zones` (through `InteractionZone`) — **une interaction peut
  déjà être rattachée à plusieurs zones**. C'est la réponse directe au cas
  « menuiseries de toute la maison ».
- La zone racine unique par foyer (`zones_one_root_per_household`) — pour un travail
  vraiment transversal, on peut rattacher à la racine.
- `metadata` (JSONField) — pour les champs structurés, comme les dépenses stockent
  déjà `amount` / `supplier` / `kind`.
- Le pattern service + endpoint + writable agent, éprouvé sur les dépenses
  (`create_manual_expense_interaction`).

Ce que ce parcours ajoute :

1. Un service `create_renovation_interaction` (+ `update_renovation_interaction`)
   dans `apps/interactions/services.py`, sur le modèle de `create_manual_expense_interaction`.
2. Un endpoint `POST /api/interactions/renovation/` (+ `PATCH`) qui consomme le service.
3. Un onglet **« Rénovation »** dans le détail zone (`ZoneDetailPage`), s'appuyant sur
   le filtre `?zone=<id>&kind=renovation` déjà supporté par le viewset.
4. Un dialog create/edit avec champs structurés + **sélection multi-zones**.
5. Un writable agent `entity_type='renovation'` branché sur le même service.

## Décisions de cadrage (confirmées avec l'utilisateur)

- **Cas « menuiseries de toute la maison » → une interaction, plusieurs zones.**
  On coche N zones sur une même entrée (M2M existant). Pas de duplication par pièce,
  pas de concept parallèle. Un raccourci « toute la maison » sélectionne toutes les
  zones du foyer.
- **Champs structurés** (pas une simple note libre) : `element` (peinture, sol, mur,
  menuiserie, plomberie, électricité, mobilier, autre), `product` (produit/matériau),
  `brand` (marque), `reference` (référence), + `subject` lisible et `content` (notes
  libres) natifs, + `occurred_at` (date des travaux).
- **Réutilisation des types existants, pas de nouveau type.** L'entrée porte un
  `type` d'interaction dans un sous-ensemble curaté — `installation` (défaut),
  `replacement`, `upgrade`, `repair`, `maintenance` — et une **catégorie transverse**
  `metadata.kind = "renovation"` qui la regroupe et la rend filtrable. Deux axes
  honnêtes : `element` = *quoi* (le sol), `type` = *quelle action* (posé/remplacé).
- **Une entrée reste une `Interaction`.** Tous les bénéfices restent acquis :
  apparition dans l'onglet Activité de la zone, indexation RAG (subject + content),
  tags, documents liés, edit/suppression via les surfaces existantes.
- **`subject` est la vérité user-facing.** Auto-composé à la création
  (`« {element} — {zone} »`, ex. « Peinture — Chambre Léa ») dans la langue de
  l'utilisateur, puis éditable. Pas de re-localisation à l'affichage (cf. CLAUDE.md).

## Concept visible côté utilisateur

- **Nouvel onglet « Rénovation »** dans le détail d'une zone (à côté de Activité,
  Projets, Photos…). Icône `Paintbrush` (ou `Hammer`).
- **Liste chronologique** des entrées `kind=renovation` de la zone : chaque carte
  affiche l'élément, le produit / la marque / la référence, la date, un extrait des
  notes. Une entrée transverse affiche un badge « + N zones ».
- **Bouton « Ajouter une entrée »** → dialog avec champs structurés + multi-zones.
- **Édition / suppression** depuis la carte (`CardActions`), suppression annulable
  (toast + undo).
- **Assistant ancré** : « quelle peinture dans la chambre de Léa ? » se répond depuis
  l'assistant de zone (le contexte de la zone est déjà pré-injecté).

## Scénarios prioritaires

### Scénario A — Chambre rénovée, deux entrées

« Je viens de rénover la chambre de ma fille. J'ouvre la zone → onglet Rénovation →
« Ajouter ». J'enregistre "Peinture / réparation, Farrow & Ball, réf. Pointing 2003"
et "Sol / installation, parquet chêne huilé, marque Panaget". Les deux apparaissent
dans le carnet de la chambre. »

### Scénario B — Menuiseries de toute la maison, une seule entrée

« J'ai changé toutes les fenêtres. J'ouvre une pièce → « Ajouter » → élément
"Menuiserie", type "Remplacement", marque "Tryba", et je coche toutes les pièces
concernées (ou « toute la maison »). L'entrée apparaît dans le carnet de chacune. »

### Scénario C — Racheter le même produit six mois plus tard

« Je veux racheter la même peinture. J'ouvre la chambre → onglet Rénovation, je lis
la marque et la référence. Ou je demande à l'assistant de la zone. »

## Règles produit

### Règle 1 — Une entrée de carnet reste une `Interaction`

Pas de modèle `RenovationEntry`. `metadata.kind="renovation"` est le seul
discriminateur. La lecture (onglet, filtre) et l'écriture (service, endpoint,
writable) sont des couches par-dessus le socle.

### Règle 2 — Multi-zones natif, jamais de duplication

Une entrée transverse = **une** `Interaction` liée à N zones via `InteractionZone`.
Éditer les zones met à jour le M2M (`unique_together` respecté). Supprimer une zone
retire seulement la ligne `InteractionZone`, pas l'interaction (si d'autres zones
restent).

### Règle 3 — Champs structurés dans `metadata`, shape uniforme

`metadata` d'une entrée rénovation : `{kind: "renovation", element, product, brand,
reference}`. Un builder interne (`_build_renovation_metadata`) garantit le shape,
comme `_build_expense_metadata` pour les dépenses. Ajouter une clé (ex. `warranty_until`)
= un seul endroit.

### Règle 4 — `subject` auto-composé write-time, puis éditable

À la création, si l'utilisateur ne saisit pas de titre, on compose
`« {element} — {zone principale} »` via gettext dans sa langue, stocké en clair.
L'utilisateur peut l'écraser. Aucune re-localisation à l'affichage.

### Règle 5 — Anti-duplication : service = source de vérité unique

L'endpoint REST **et** le writable agent appellent `create_renovation_interaction`.
Aucune écriture via l'ORM brut ni via le serializer générique dans le handler agent.
Un test verrouille que create REST et create agent produisent le même résultat.

### Règle 6 — Scope foyer partout

Le service valide que toutes les `zone_ids` appartiennent au foyer (comme
`create_manual_expense_interaction`). Le viewset filtre par foyer sélectionné.

## Backlog produit V1

| Lot | But | Issue |
|---|---|---|
| 13.1 | Backend — service `create/update_renovation_interaction`, endpoint, metadata builder | #239 |
| 13.2 | Frontend — onglet Rénovation dans le détail zone, dialog create/edit multi-zones, undo, i18n | #240 |
| 13.3 | Agent — writable `renovation` + description tool, tests parité REST/agent | #241 |

Une branche `feat/interactions-renovation-log`, une PR vers `main`.

### Story 13.1 — Backend

En tant que membre du foyer,
je veux enregistrer une entrée de rénovation structurée rattachée à une ou plusieurs zones,
afin de garder une trace exploitable de ce qui a été fait.

**Critères d'acceptation**
- Service `create_renovation_interaction(*, household, user, element, product, brand,
  reference, interaction_type, subject=None, occurred_at, notes, zone_ids)` dans
  `apps/interactions/services.py`, flow through `_build_renovation_metadata`.
- `type` validé contre le sous-ensemble `{installation, replacement, upgrade, repair,
  maintenance}` (défaut `installation`) ; rejet sinon.
- `subject` auto-composé via gettext (`« {element} — {zone} »`) si non fourni ;
  templates enregistrés + `makemessages`/`compilemessages` fr/de/es.
- Au moins une `zone_id`, toutes scopées foyer (rejet sinon).
- Service `update_renovation_interaction` : édite element/product/brand/reference/
  subject/content/occurred_at/type + resync des zones.
- Endpoints `POST /api/interactions/renovation/` et `PATCH .../renovation/{id}/`
  (ou action detail) consommant les services, avec `RenovationSerializer` d'entrée.
- Le viewset existant filtre déjà `?zone=&kind=renovation` — vérifier, sinon compléter.
- Tests pytest : service (happy path, multi-zones, zone hors foyer, type invalide,
  subject auto vs fourni), endpoint (201, scope, 400).

### Story 13.2 — Frontend

En tant que membre du foyer,
je veux un onglet Rénovation dans chaque zone pour consulter et saisir les entrées,
afin de tout gérer depuis la pièce concernée.

**Critères d'acceptation**
- Onglet « Rénovation » dans `ZoneDetailPage` (via `TABS`), liste triée par
  `occurred_at` desc, filtrée `kind=renovation`.
- Carte (`Card` + `CardActions`) : élément, produit/marque/référence, date, extrait
  notes, badge « + N zones » si transverse.
- État vide (`EmptyState`-like) + CTA, skeleton `useDelayedLoading`.
- Dialog create/edit (`RenovationDialog`, prop `existing?`) : select élément, select
  nature (type), champs produit/marque/référence, date, notes, titre optionnel,
  **multi-select de zones** (zone courante pré-cochée, raccourci « toute la maison »).
- Client API `ui/src/lib/api/renovation.ts` + hooks (`hooks.ts`) : query keys,
  create/update mutations (toast + invalidation), suppression via `useDeleteWithUndo`.
- i18n complet en/fr/de/es (namespace `renovation`), zéro `defaultValue`.
- Tokens couleur design-system uniquement.
- E2E Playwright : ajouter une entrée depuis une zone, la voir dans le carnet.

### Story 13.3 — Agent

En tant que membre du foyer,
je veux pouvoir dire à l'assistant « note que j'ai refait la peinture de la chambre
avec du Farrow & Ball » et retrouver l'info plus tard,
afin de capturer sans ouvrir de formulaire.

**Critères d'acceptation**
- `WritableSpec(entity_type='renovation')` dans `apps/interactions/apps.py`,
  `create` = mince adaptateur vers `create_renovation_interaction`, exploitant
  l'`anchor` zone (conversation ancrée sur une zone → zone pré-rattachée).
- `update`/`resolve`/`delete` déclarés (miroir du writable `note`).
- Extension de `_CREATE_ENTITY_SCHEMA` / `_CREATE_ENTITY_DESCRIPTION` dans
  `apps/agent/tools.py` pour lister les champs de `renovation`.
- Entrée `renovation` dans `UNDO_HANDLERS` (+ update) côté `ui/src/features/agent/hooks.ts`.
- Test : create REST et create agent produisent une `Interaction` identique (même
  `type`, `metadata`, zones) — verrou anti-duplication.

## Hors scope V1

- **Garantie & document justificatif** (`warranty_until`, facture/échantillon lié) —
  le socle `InteractionDocument` le permet déjà ; à activer si l'usage le réclame.
- **Photo avant/après** dédiée — les photos de zone existent déjà (parcours 05).
- **Indexation RAG des champs `metadata`** (brand/reference dans le search vector) —
  la V1 indexe `subject` + `content` ; on enrichira si « quelle réf de sol ? » ne
  remonte pas assez bien.
- **Taxonomie d'éléments fermée / configurable par foyer** — la liste d'`element` est
  un select fixe en V1, on raffine sur signal réel.
- **Vue transversale « tout ce que j'ai rénové dans la maison »** — le carnet est
  par zone en V1 ; une vue maison globale viendra si le besoin émerge.

## Définition de done — V1

1. Depuis une zone, on enregistre une entrée structurée (élément, produit, marque,
   référence, date, notes) rattachée à une ou plusieurs zones.
2. L'onglet Rénovation de chaque zone concernée affiche l'entrée, avec badge
   « + N zones » si transverse.
3. Édition et suppression (avec undo) fonctionnent depuis la carte.
4. L'assistant de zone peut créer une entrée sur demande explicite et la citer.
5. create REST et create agent produisent un résultat identique (test vert).
6. i18n complet en/fr/de/es ; `pytest` et `npm run lint` verts.

## Recette manuelle (à pratiquer après livraison)

1. Enregistrer une dizaine d'entrées réelles (chambre, salon, menuiseries maison).
2. Observer : la liste fixe d'éléments suffit-elle ? Manque-t-il la garantie, la
   photo, le lien facture ? La distinction `element`/`type` est-elle claire ou
   redondante ? Ouvrir des issues ciblées plutôt que spéculer sur la V2.
