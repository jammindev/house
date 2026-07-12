---
name: new-feature
description: Construire une nouvelle feature complète du projet house — backend Django, câblage agent (search/list/create/update) et interface React — sans duplication de code. Utiliser quand l'utilisateur demande d'implémenter une nouvelle feature, un nouveau module ou une nouvelle entité métier.
---

# Nouvelle feature — backend + agent + UI, zéro duplication

Une feature de ce projet a **trois faces sur un seul socle** : l'API REST, l'agent
conversationnel et l'UI React consomment tous la même logique métier. La règle
anti-duplication tient en trois points :

1. **`apps/<app>/services.py` est la source de vérité des écritures.** Le viewset
   REST **et** les writables de l'agent appellent le même service (validation via
   serializer, scope foyer, fallbacks). Jamais deux chemins d'écriture, jamais
   d'ORM brut dans le handler agent. Référence : `apps/tasks/services.py`.
2. **L'agent ne reçoit pas de code spécifique** : il se branche sur les modèles
   existants via les registries `searchables` / `listables` / `writables` déclarés
   dans `apps.py::ready()`. On ne touche `apps/agent/` que pour étendre les
   *descriptions* des tools génériques. Référence complète : `apps/tasks/apps.py`.
3. **Côté UI, une seule couche d'accès API** (`ui/src/lib/api/<feature>.ts`),
   wrappée par les hooks React Query. Les composants réutilisent le design-system
   et les composants partagés (`Card`, `CardActions`, `BackLink`, `PurchaseForm`,
   `EntityAssistant`…) — jamais de copie locale.

## Étape 0 — Cadrage

Vérifier qu'un cadrage existe (`docs/parcours/` + issues GitHub). S'il n'existe
pas et que la demande est un nouveau module entier, proposer de cadrer d'abord
(docs + issues) avant de coder — coder seulement sur demande explicite.

Pour un changement non-trivial : feature branch depuis `main`
(`feat/<app>-<description>`), PR vers `main`.

## Étape 1 — Backend Django

Dans `apps/<app>/` (créer l'app si nécessaire, ou étendre une existante) :

0. **Choix de modélisation AVANT tout schéma** : pour chaque entrée « journal »
   de la feature, trancher **`Interaction` vs modèle dédié** avec la règle de
   décision du CLAUDE.md (section « Interaction vs modèle dédié »). En bref :
   fait daté, plat, sans invariant → `Interaction` + `metadata.kind` ; besoin
   d'une contrainte DB, d'une machine à états, d'une FK typée ou de requêtes sur
   les champs structurés → modèle dédié. Ne pas créer de table qui duplique ce
   que le journal du foyer offre déjà (fil d'activité, dépenses, RAG, liaisons).
1. **`models.py`** — hériter de `HouseholdScopedModel` (scope foyer). Puis
   `makemigrations` + `migrate`.
2. **`serializers.py`** — validation, champs exposés.
3. **`services.py`** — fonctions `create_<entity>(household, user, ...)` /
   `update_<entity>(...)` qui passent par le serializer. C'est LE point d'entrée
   métier : le viewset et l'agent l'appellent tous les deux. Docstring expliquant
   ce contrat (voir `apps/tasks/services.py`).
4. **`views.py`** — viewset DRF dont `perform_create`/`perform_update` délèguent
   au service (pas de logique métier dupliquée dans la view).
5. **`urls.py`** + enregistrement dans `config/urls.py`
   (`path("api/<app>/", include("<app>.urls"))`) + `INSTALLED_APPS` dans
   `config/settings/base.py`.
6. **`admin.py`** — enregistrement admin basique.
7. Si la feature déclenche une dépense → utiliser
   `interactions.services.create_expense_interaction` (voir CLAUDE.md), pas une
   création d'`Interaction` à la main.

## Étape 2 — Câblage agent (dans `apps.py::ready()` de l'app)

Tout se fait par déclaration — **aucune modification de la logique de
`apps/agent/`**. Modèle complet : `apps/tasks/apps.py`.

1. **Lecture / RAG** — `SearchableSpec` (`agent.searchables`) :
   `entity_type`, `model`, `search_fields`, `label_attr`, `url_template`.
   Ajouter `related` si la page détail doit injecter des items liés dans
   l'assistant ancré.
2. **Listing / agrégats** — `ListableSpec` (`agent.listables`) avec des
   `ListFilter` nommés + un `describe` compact.
3. **Écritures** — `WritableSpec` (`agent.writables`) : les callbacks
   `create` / `update` sont de **minces adaptateurs** qui mappent `fields` vers le
   service de l'étape 1 (et exploitent l'`anchor` de conversation pour
   pré-remplir les liens). `resolve` = lookup scopé foyer.
4. **Descriptions des tools** — étendre `_CREATE_ENTITY_SCHEMA` /
   `_CREATE_ENTITY_DESCRIPTION` (et équivalents update/list) dans
   `apps/agent/tools.py` pour documenter les champs de la nouvelle entité.
   C'est la seule retouche dans `apps/agent/`.

## Étape 3 — Frontend React

1. **Client API** — `ui/src/lib/api/<feature>.ts` : types + fonctions fetch/CRUD
   via `api` (`@/lib/axios`). Si les types générés doivent être rafraîchis :
   skill `/gen-api` (serveur Django sur :8001 requis).
2. **Feature** — `ui/src/features/<feature>/` en suivant le **pattern standard
   Feature page du CLAUDE.md** (à respecter strictement) :
   - `hooks.ts` : factory de query keys + hooks query/mutation (toast +
     invalidation), suppression via `useDeleteWithUndo`.
   - `<Feature>Page.tsx` : `PageHeader`, `FilterPill` + `useSessionState`,
     skeleton `useDelayedLoading`, `EmptyState`.
   - `<Feature>Card.tsx` : `Card` + `CardTitle` + `CardActions`.
   - `<Feature>Dialog.tsx` : create/edit via prop `existing?`.
   - Page détail : `BackLink` + `pushBack` (jamais `navigate(-1)`).
   - Tokens couleur du design-system uniquement (pas de couleurs hardcodées).
3. **Routing + nav** — routes lazy dans `ui/src/router.tsx`
   (`lazyWithReload`), entrée dans `ui/src/components/Sidebar.tsx`.
4. **Assistant ancré** — sur la page détail, une ligne :
   `<EntityAssistant entityType="<entity_type>" objectId={item.id} />`
   (fonctionne grâce au `SearchableSpec` de l'étape 2).
5. **Undo des créations agent** — si l'entité est writable : ajouter une entrée
   dans `UNDO_HANDLERS` (`ui/src/features/agent/hooks.ts`), et son miroir update
   si `update` est déclaré.
6. **i18n** — skill `/translate` pour toutes les clés (4 langues, jamais de
   `defaultValue`).

## Étape 4 — Tests et documentation

1. **Tests backend** — agent `django-drf-test-writer` : viewset + services +
   registries agent (le create agent et le create REST doivent produire le même
   résultat — c'est le test qui verrouille la non-duplication).
2. **Tests E2E** — agent `playwright-e2e-writer` sur le flow critique de la page.
3. **Docs** — créer/mettre à jour `docs/MODULES/<app>.md` (structure : voir les
   fiches existantes).
4. **Tutoriels** — skill `/tutorials` : ajouter le guide du nouveau module (ou
   l'étape correspondante d'un guide existant) dans la page Tutoriel, registre +
   4 locales.
5. `pytest` + `npm run lint` avant de pousser la PR.

## Check final anti-duplication

- [ ] Le handler agent `create`/`update` appelle le service, pas l'ORM ni le serializer directement
- [ ] Le viewset délègue au même service
- [ ] Aucune logique métier copiée dans `apps/agent/`
- [ ] Un seul fichier client API côté UI, consommé uniquement via les hooks
- [ ] Composants partagés réutilisés (`Card`, `CardActions`, `BackLink`, `EntityAssistant`, `PurchaseForm` si dépense)
- [ ] Clés i18n partagées (`common.*`, `purchase.*`) réutilisées avant d'en créer des feature-spécifiques
