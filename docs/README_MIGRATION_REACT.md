# README — Migration React `legacy/` (Next.js) -> Django hybride

Ce document sert de **plan d’exécution** et de **contexte IA évolutif** pour migrer les composants React du dossier `legacy/` vers l’app active Django + Vite.

Statut mars 2026: la migration de données Supabase -> Django est finalisée sur le périmètre actif. Ce document est désormais centré sur la finalisation UI de toutes les apps actives.

---

## 1) Objectif

Construire/compléter l’UI de toutes les apps Django, en réutilisant le legacy uniquement comme référence d’intention, sans casser la prod, en respectant l’architecture actuelle :

- Django-first (templates + DRF)
- React ciblé (zones interactives)
- Pas de dépendance runtime à Next.js/Supabase

---

## 2) Règle de vérité (important)

- **Code actif** = racine projet (`config/`, `apps/`, `templates/`, `ui/`)
- **`legacy/`** = documentation fonctionnelle et source d’intention
- En cas de divergence, on suit le code actif

## 2.1) Règle de portage UI (obligatoire)

- Reprendre **exactement** les mêmes composants React de `legacy` quand ils existent déjà.
- Conserver **la même découpe de fichiers** que `legacy`, notamment en `pages` et `features`.
- Ne pas réinventer l'architecture des features: conserver la structure métier et les boundaries de fichiers.
- Adapter uniquement les mécanismes Next.js/Supabase au runtime Django: routing/navigation, chargement de données, auth, server actions, `next/link`, `next/image`, etc.

---

## 3) Priorisation de migration (A/B/C)

## A — UI atomique (à faire en premier)
Composants de présentation réutilisables.

Exemples:
- boutons, inputs, cards, badges, modals, tabs, dropdowns

Critères:
- pas de `next/*`
- pas de `useRouter`
- pas d’appel API
- pas de dépendance auth

Livrable attendu:
- composant porté dans `ui/src/...`
- démo utilisable dans template Django

## B — Listes + états simples
Composants avec logique légère de données.

Exemples:
- listes d’items, filtres simples, pagination simple, états loading/empty/error

Critères:
- appels DRF possibles
- pas de workflow métier complexe

Livrable attendu:
- composant branché sur endpoint DRF existant
- fallback propre côté template

## C — Écrans métier complets (en dernier)
Pages/features complètes fortement couplées à Next/Supabase.

Exemples:
- routes Next complètes
- auth Supabase
- flows OCR/IA avancés

Critères:
- dépendances `next/link`, `next/image`, `useRouter`, server actions, API routes Next

Livrable attendu:
- migration en lot dédié, après stabilisation A+B

---

## 4) Ordre d’exécution recommandé (4 phases)

## Phase 1 — Audit rapide (1 à 2 jours)
1. Cartographier les composants legacy candidats (A/B/C).
2. Identifier dépendances bloquantes Next/Supabase.
3. Définir une première shortlist A (5 composants max).

Sortie:
- tableau de tri complété (section 7)

## Phase 2 — Quick wins UI (2 à 4 jours)
1. Porter 2 à 3 composants A.
2. Uniformiser style/tokens existants.
3. Exposer les composants via Web Components ou montage ciblé React.

Sortie:
- composants visibles dans page de test template

## Phase 3 — Intégration données simple (2 à 5 jours)
1. Porter 1 composant B (liste + états).
2. Brancher à un endpoint DRF stable.
3. Gérer erreurs, vide, chargement.

Sortie:
- feature utile en lecture stable

## Phase 4 — Préparation lots métier (continu)
1. Découper les écrans C en sous-composants.
2. Déplacer logique de données vers services côté UI.
3. Planifier migrations écran par écran.

Sortie:
- backlog C priorisé et prêt à implémenter

---

## 5) Check-list technique à respecter

Avant de porter un composant:
- [ ] Vérifier qu’il est bien en catégorie A ou B
- [ ] Lister ses imports Next/Supabase à retirer
- [ ] Vérifier la source des données côté DRF (endpoint existant)

Pendant le portage:
- [ ] Remplacer `next/link` par lien HTML ou composant local
- [ ] Remplacer `next/image` par `img`/solution locale
- [ ] Retirer `useRouter` au profit de navigation Django/props
- [ ] Isoler la logique API dans un service frontend
- [ ] Préserver accessibilité (labels, aria, focus)

Après portage:
- [ ] Tester affichage en template Django
- [ ] Vérifier loading/empty/error
- [ ] Vérifier compatibilité thème/style
- [ ] Mettre à jour ce README (section journal)

---

## 6) Mapping technique (legacy -> cible)

- `legacy` composant UI pur -> `ui/src/components/*`
- `legacy` utilitaire UI -> `ui/src/lib/*`
- montage template -> `ui/src/lib/mount.tsx`
- web component réutilisable -> `ui/src/web-components/*`
- page de démo Django -> `templates/app/components_demo.html`
- composant feature complexe -> `templates/app/*.html` + point de montage `<div id=...>` + entry `ui/src/pages/*` (pas de Web Component)

## 6.1) Pattern validé pour les lots B (comment c’est fait)

Pour un composant B (liste, formulaire, feature légère), on applique ce flux:

1. **Vue Django**: fetch initial côté serveur (household + dataset principal).
2. **Template Django**:
	- ajouter un point de montage `<div id="...">`
	- injecter les props initiales via `{{ props|json_script:"..." }}`
3. **Entry frontend page** (`ui/src/pages/*.tsx`):
	- utiliser le helper partagé de montage (`ui/src/lib/mount.tsx`)
	- `onDomReady(() => mountWithJsonScriptProps(...))`
	- éviter de dupliquer `createRoot` + parsing `json_script` dans chaque page
4. **Composant React feature**:
	- accepter `initial*` (`initialItems`, `initialZones`, `initialLoaded`, etc.)
	- éviter un fetch initial redondant quand les données serveur existent déjà
5. **Service API frontend**:
	- garder les appels DRF pour rafraîchissement / interactions utilisateur (submit, reload, filtres)

Ce pattern est celui utilisé pour:
- `InteractionList` (`/app/interactions/`)
- `InteractionCreateForm` (`/app/interactions/new/`)

### 6.2) Convention obligatoire pour les lots B (montage React)

Pour tout nouveau lot B, le montage doit passer par les helpers partagés:

- `onDomReady`
- `mountWithJsonScriptProps`

Objectif:

- réduire le boilerplate dans `ui/src/pages/*`
- standardiser l’injection des props Django (`json_script`)
- limiter les divergences de comportement entre pages B

---

## 7) Tableau de tri des candidats (à maintenir)

| Composant legacy | Catégorie | Dépendances bloquantes | Difficulté | Cible Django/React | Statut |
|---|---|---|---|---|---|
| `legacy/nextjs/src/components/ui/input.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/input.tsx` + `ui/src/web-components/Input.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/badge.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/badge.tsx` + `ui/src/web-components/Badge.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/card.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/card.tsx` + `ui/src/web-components/Card.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/textarea.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/textarea.tsx` + `ui/src/web-components/Textarea.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/select.tsx` | A | dépendances primitives UI à simplifier | M | `ui/src/components/ui/select.tsx` + `ui/src/web-components/Select.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/alert.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/alert.tsx` + `ui/src/web-components/Alert.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/components/ui/skeleton.tsx` | A | aucune (UI pure) | S | `ui/src/components/ui/skeleton.tsx` + `ui/src/web-components/Skeleton.tsx` + `templates/app/components_demo.html` | DONE |
| `legacy/nextjs/src/features/interactions/components/InteractionList.tsx` | B | dépend de la donnée interactions + i18n legacy à simplifier | M | `ui/src/components/features/InteractionList.tsx` + `ui/src/lib/api/interactions.ts` + `ui/src/pages/interactions.tsx` + `templates/app/interactions.html` + fetch serveur initial + filtres `type/status` + pagination/"voir plus" | DONE |
| `legacy` interaction creation flow (`/app/interactions/new`) | B | dépend création DRF + zones + validation | M | `ui/src/components/features/InteractionCreateForm.tsx` + `ui/src/lib/api/interactions.ts` + `ui/src/lib/api/zones.ts` + `ui/src/pages/interaction-new.tsx` + `templates/app/interaction_new.html` + fetch serveur initial + redirection/rafraîchissement liste | DONE |

Légende statut: `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`

---

## 8) Journal d’implémentation (à mettre à jour par l’IA)

## Entrée type

Date:
Lot:
Composants migrés:
Fichiers modifiés:
Décisions techniques:
Risques restants:
Prochaine étape:

## Historique

- Date: 2026-02-20
	Lot: A1 — UI atomique (2 composants)
	Composants migrés: `Input`, `Badge` (en plus du `Button` déjà présent)
	Fichiers modifiés:
	- `ui/src/components/ui/input.tsx`
	- `ui/src/components/ui/badge.tsx`
	- `ui/src/web-components/Input.tsx`
	- `ui/src/web-components/Badge.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	- `apps/accounts/views/template_views.py`
	- `apps/accounts/views/__init__.py`
	- `config/urls.py`
	Décisions techniques:
	- Lot limité strictement à des composants catégorie A (UI pure, sans API/auth).
	- Exposition via Web Components (`ui-input`, `ui-badge`) pour usage direct en template Django.
	- Démo centralisée sur `/app/components/` pour validation visuelle rapide.
	Risques restants:
	- Le wrapper générique `createWebComponent` reste basique pour des composants complexes à slots riches.
	- Les composants atomiques suivants (Card/Textarea/Select/Modal...) ne sont pas encore portés.
	- Pas encore de page de catalogue UI complète avec tests visuels automatisés.
	Prochaine étape:
	- Lot A2: porter `Card` + `Textarea`, puis enrichir la page `/app/components/` avec états focus/disabled/error.

- Date: 2026-02-20
	Lot: A2 — UI atomique (2 composants)
	Composants migrés: `Card`, `Textarea`
	Fichiers modifiés:
	- `ui/src/components/ui/card.tsx`
	- `ui/src/components/ui/textarea.tsx`
	- `ui/src/web-components/Card.tsx`
	- `ui/src/web-components/Textarea.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	Décisions techniques:
	- `ui-card` exposé avec props simples (`title`, `description`, `content`, `footer`) pour rester utilisable rapidement en template Django.
	- `ui-textarea` expose les props standards et events (`ui-input`, `ui-change`, `ui-focus`, `ui-blur`).
	- La démo `/app/components/` couvre maintenant boutons, input, badges, textarea et card.
	Risques restants:
	- `Select` et composants atomiques avancés (modal/dialog/dropdown/tabs) restent à porter.
	- Le mapping `class`/`className` des Web Components n'est pas standardisé pour les variantes de style template-side.
	Prochaine étape:
	- Lot A3: porter `Select` (ou fallback natif), puis préparer `Modal/Dialog` en vérifiant les dépendances UI.

- Date: 2026-02-20
	Lot: A3 — UI atomique (1 composant)
	Composants migrés: `Select`
	Fichiers modifiés:
	- `ui/src/components/ui/select.tsx`
	- `ui/src/web-components/Select.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- Implémentation en `select` HTML natif stylé, sans dépendance Radix/Next, pour rester aligné migration Django-first.
	- Exposition via Web Component `ui-select` avec `options` en JSON (attribut) pour usage direct en template Django.
	- Événements standards propagés en custom events (`ui-input`, `ui-change`, `ui-focus`, `ui-blur`).
	Risques restants:
	- Composants atomiques plus complexes (modal/dialog/dropdown/tabs) restent à cadrer sans sur-introduire de dépendances.
	- Le wrapper générique des Web Components ne gère pas encore finement les slots complexes/templating avancé.
	Prochaine étape:
	- Lot A4: préparer `Dialog/Modal` avec version minimale accessible, puis évaluer `Tabs`.

- Date: 2026-02-20
	Lot: A4 — UI atomique (2 composants)
	Composants migrés: `Alert`, `Skeleton`
	Fichiers modifiés:
	- `ui/src/components/ui/alert.tsx`
	- `ui/src/components/ui/skeleton.tsx`
	- `ui/src/web-components/Alert.tsx`
	- `ui/src/web-components/Skeleton.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- `Alert` porté en version atomique simple (`default` / `destructive`) avec structure `title` + `description`.
	- `Skeleton` porté en composant de base avec API minimale (`width`, `height`, `circle`) adaptée au templating Django.
	- Exposition en Web Components (`ui-alert`, `ui-skeleton`) pour intégration progressive côté templates.
	Risques restants:
	- Les composants A basés sur primitives avancées (dialog/dropdown/tooltip/tabs) restent à adapter sans dépendances lourdes.
	- Le support d’API de contenu riche (slots complexes) côté Web Components reste limité.
	Prochaine étape:
	- Lot A5: porter `Label` + `Separator` (versions sans Radix) ou lancer un premier composant B de liste simple branché DRF.

- Date: 2026-02-20
	Lot: B1 — Liste interactions (lecture)
	Composants migrés: `InteractionList` (liste + états loading/empty/error)
	Fichiers modifiés:
	- `ui/src/lib/api/interactions.ts`
	- `ui/src/components/features/InteractionList.tsx`
	- `ui/src/pages/interactions.tsx`
	- `ui/vite.config.ts`
	- `templates/app/interactions.html`
	- `apps/interactions/views_web.py`
	- `apps/interactions/web_urls.py`
	- `config/urls.py`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- Premier lot B branché sur endpoint DRF existant: `GET /api/interactions/interactions/`.
	- Service API frontend dédié (`fetchInteractions`) avec normalisation pagination DRF (`results`) ou tableau brut.
	- Composant complexe monté directement dans un `<div>` (pas de Web Component), via entry `src/pages/interactions.tsx`.
	- Données initiales préchargées côté serveur (household + interactions) pour le premier rendu.
	- États UI gérés explicitement: chargement (`Skeleton`), erreur (`Alert`), vide (message), succès (liste).
	Risques restants:
	- Le contexte household peut nécessiter `X-Household-Id` explicite si l’utilisateur appartient à plusieurs households.
	- Version actuelle en lecture seule (pas de filtres avancés/pagination serveur visible).
	Prochaine étape:
	- Lot B2: ajouter filtres simples (`type`, `status`) côté template + option de pagination/"voir plus".

- Date: 2026-02-20
	Lot: B2 — Formulaire de création interactions (priorité demandée)
	Composants migrés: `InteractionCreateForm`
	Fichiers modifiés:
	- `ui/src/lib/api/interactions.ts`
	- `ui/src/lib/api/zones.ts`
	- `ui/src/components/features/InteractionCreateForm.tsx`
	- `ui/src/pages/interaction-new.tsx`
	- `ui/vite.config.ts`
	- `templates/app/interaction_new.html`
	- `templates/app/interactions.html`
	- `apps/interactions/views_web.py`
	- `apps/interactions/web_urls.py`
	- `config/urls.py`
	- `core/permissions.py`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- Passage en priorité sur le formulaire de création, comme demandé, avant les filtres avancés de liste.
	- **Règle appliquée**: composant complexe monté directement dans un `<div>` (pas de Web Component).
	- Données initiales fetch côté serveur (household + zones) et injectées pour le rendu initial.
	- Formulaire connecté à `POST /api/interactions/interactions/` avec session auth + CSRF + gestion `X-Household-Id`.
	- États UI complets: loading zones (fallback), erreur validation/API, succès après création.
	Risques restants:
	- En multi-households, la sélection explicite du household peut rester nécessaire selon le contexte utilisateur.
	- Pas encore de redirection automatique vers le détail après création.
	Prochaine étape:
	- Lot B3: enrichir liste interactions avec filtres `type/status` + rafraîchissement après création.

- Date: 2026-02-20
	Lot: B3 — Filtres interactions + rafraîchissement post-création
	Composants migrés: `InteractionList` (filtres `type/status`), `InteractionCreateForm` (redirection post-création)
	Fichiers modifiés:
	- `ui/src/components/features/InteractionList.tsx`
	- `ui/src/components/features/InteractionCreateForm.tsx`
	- `apps/interactions/views_web.py`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- Filtres `type` et `status` gérés côté composant React via `GET /api/interactions/interactions/?type=...&status=...`.
	- Conservation du pattern initial SSR (`initialItems`) avec option `forceReloadOnMount` pour forcer un refetch si nécessaire.
	- Après création réussie, redirection automatique vers `/app/interactions/?refresh=1` pour déclencher un rafraîchissement explicite de la liste.
	Risques restants:
	- Les options de filtres sont actuellement statiques (alignées modèle) et non pilotées dynamiquement par l’API.
	- Pas encore de persistance des filtres dans l’URL lors de manipulations côté client.
	Prochaine étape:
	- Lot B4: pagination côté serveur/"voir plus" + conservation optionnelle des filtres dans l’URL.

- Date: 2026-02-20
	Lot: B4 — Pagination interactions + persistance filtres URL
	Composants migrés: `InteractionList` (pagination `limit/offset` + bouton "Voir plus"), API interactions DRF paginée
	Fichiers modifiés:
	- `apps/interactions/views.py`
	- `ui/src/lib/api/interactions.ts`
	- `ui/src/components/features/InteractionList.tsx`
	- `apps/interactions/views_web.py`
	- `README_MIGRATION_REACT.md`
	Décisions techniques:
	- Activation pagination DRF sur `InteractionViewSet` via `LimitOffsetPagination` (default `8`, max `100`).
	- Service frontend `fetchInteractions` enrichi pour gérer `limit/offset` et métadonnées (`count`, `next`, `previous`).
	- `InteractionList` ajoute un mode "voir plus" avec append progressif et déduplication défensive des items.
	- Les filtres `type/status` sont synchronisés dans l’URL via `history.replaceState` pour conserver le contexte de navigation.
	Risques restants:
	- Le backend n’expose pas encore dynamiquement la liste des types/status disponibles pour alimenter les selects.
	- La synchro URL est actuellement unidirectionnelle (état -> URL), pas encore enrichie pour restaurer un état complexe depuis toute query custom.
	Prochaine étape:
	- Lot B5: alimenter les filtres depuis métadonnées API + améliorer UX (compteur total/filtres actifs/clear chips).

---

## 9) Prompt prêt à copier pour l’IA (implémentation)

"Tu travailles sur une migration React progressive de `legacy/` (Next.js) vers une app Django hybride.
Suis strictement `README_MIGRATION_REACT.md`.
Commence par un lot A (2 composants max), sans toucher aux écrans C.
Interdiction d’introduire une dépendance runtime à Next.js/Supabase.
Après implémentation:
1) mets à jour la section Journal d’implémentation,
2) mets à jour le tableau de tri (statuts),
3) résume les fichiers modifiés et les prochains risques."

---

## 10) Fichiers de référence

- `AGENTS.md`
- `AI_CONTEXT_MIGRATION.md`
- `HYBRID_ARCHITECTURE.md`
- `legacy/AGENTS.md`
- `legacy/README.md`
- `legacy/STRUCTURE.md`
- `ui/src/lib/mount.tsx`
- `ui/src/web-components/`
- `templates/app/components_demo.html`
- `README_ATOMIC_COMPONENTS.md`
