# Guide React UI — Architecture et patterns

Ce document décrit l'architecture des composants React dans l'app Django hybride et les patterns d'intégration.

Statut mars 2026 : tous les composants atomiques et les premières features B sont en place. Ce document sert de référence pour tout ajout ou modification de la couche React.

---

## 1) Architecture

Le projet suit une approche **Django-first** avec React ciblé sur les zones UI riches :

- Django rend les pages et les routes (templates)
- React est ajouté uniquement pour les interfaces interactives complexes
- Les assets React sont buildés par Vite et servis via `django-vite`

**Source de vérité runtime** : `config/`, `apps/`, `templates/`, `ui/`

---

## 2) Catégories de composants

### A — Composants atomiques (`ui/src/components/ui/`)

Composants de présentation réutilisables, sans logique métier ni appel API.

Exemples : `Button`, `Input`, `Badge`, `Card`, `Textarea`, `Select`, `Alert`, `Skeleton`

Critères :
- pas d'appel API
- pas de dépendance auth
- pas de couplage routeur/app métier

Exposition via Web Components (`ui-button`, `ui-input`, etc.) pour usage direct en templates Django.

### B — Features légères (`ui/src/components/features/`)

Composants avec logique de données branchés sur les endpoints DRF.

Exemples : `InteractionList`, `InteractionCreateForm`

Critères :
- appels DRF
- pas de workflow métier complexe multi-étapes

Montage ciblé dans un `<div id="...">` Django via les helpers partagés.

### C — Features complexes (montage dédié)

Pages complètes avec état riche, routing interne, workflows multi-étapes.

Exemples : `ElectricityBoardNode`

Montage via entry Vite dédiée, sans Web Component.

---

## 3) Pattern de montage (lots B et C)

Pour un composant B/C, on applique ce flux :

1. **Vue Django** (`views_web.py`) : fetch initial côté serveur (household + dataset principal).
2. **Template Django** :
	- ajouter un point de montage `<div id="...">`
	- injecter les props initiales via `{{ props|json_script:"..." }}`
3. **Entry frontend** (`ui/src/pages/*.tsx`) :
	- utiliser `onDomReady(() => mountWithJsonScriptProps(...))`
	- éviter de dupliquer `createRoot` + parsing `json_script` dans chaque page
4. **Composant React feature** :
	- accepter `initial*` (`initialItems`, `initialZones`, `initialLoaded`, etc.)
	- éviter un fetch initial redondant quand les données serveur existent déjà
5. **Service API frontend** :
	- garder les appels DRF pour les interactions utilisateur (submit, reload, filtres)

### 3.1) Convention obligatoire pour les montages B

Pour tout nouveau montage B, utiliser les helpers partagés :

- `onDomReady`
- `mountWithJsonScriptProps`

Objectif : standardiser l'injection des props Django et réduire le boilerplate dans `ui/src/pages/*`.

---

## 4) Mapping des composants actifs

| Composant | Catégorie | Fichiers React | Template Django | Statut |
|---|---|---|---|---|
| `Button` | A | `ui/src/components/ui/button.tsx` + `ui/src/web-components/Button.tsx` | `templates/app/components_demo.html` | DONE |
| `Input` | A | `ui/src/components/ui/input.tsx` + `ui/src/web-components/Input.tsx` | `templates/app/components_demo.html` | DONE |
| `Badge` | A | `ui/src/components/ui/badge.tsx` + `ui/src/web-components/Badge.tsx` | `templates/app/components_demo.html` | DONE |
| `Card` | A | `ui/src/components/ui/card.tsx` + `ui/src/web-components/Card.tsx` | `templates/app/components_demo.html` | DONE |
| `Textarea` | A | `ui/src/components/ui/textarea.tsx` + `ui/src/web-components/Textarea.tsx` | `templates/app/components_demo.html` | DONE |
| `Select` | A | `ui/src/components/ui/select.tsx` + `ui/src/web-components/Select.tsx` | `templates/app/components_demo.html` | DONE |
| `Alert` | A | `ui/src/components/ui/alert.tsx` + `ui/src/web-components/Alert.tsx` | `templates/app/components_demo.html` | DONE |
| `Skeleton` | A | `ui/src/components/ui/skeleton.tsx` + `ui/src/web-components/Skeleton.tsx` | `templates/app/components_demo.html` | DONE |
| `InteractionList` | B | `ui/src/components/features/InteractionList.tsx` + `ui/src/pages/interactions.tsx` | `templates/app/interactions.html` | DONE |
| `InteractionCreateForm` | B | `ui/src/components/features/InteractionCreateForm.tsx` + `ui/src/pages/interaction-new.tsx` | `templates/app/interaction_new.html` | DONE |

Légende statut : `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED`

---

## 5) Checklist technique — ajouter un composant A

- [ ] Créer le composant dans `ui/src/components/ui/<Nom>.tsx`
- [ ] Créer le Web Component dans `ui/src/web-components/<Nom>.tsx` (utiliser `createWebComponent()`)
- [ ] Ajouter l'entry dans `ui/vite.config.ts` (`rollupOptions.input`)
- [ ] Ajouter un exemple dans `templates/app/components_demo.html`
- [ ] Mettre à jour ce README (tableau section 4)
- [ ] Build frontend OK (`npm run build`)

## 5.1) Checklist technique — ajouter un composant B

- [ ] Vue Django : fetch serveur + `json_script` dans le template
- [ ] Entry React : `onDomReady(() => mountWithJsonScriptProps(...))`
- [ ] Composant : accepter `initial*`, éviter le fetch redondant
- [ ] Service API : appels DRF pour les actions utilisateur
- [ ] Mettre à jour ce README (tableau section 4)

---

## 6) Mapping technique (source → cible Django)

- composant UI pur → `ui/src/components/ui/*`
- utilitaire UI → `ui/src/lib/*`
- montage template → `ui/src/lib/mount.tsx`
- web component réutilisable → `ui/src/web-components/*`
- page de démo Django → `templates/app/components_demo.html`
- composant feature complexe → `templates/app/*.html` + `<div id=...>` + entry `ui/src/pages/*`

---

## 7) Journal d'implémentation

### Format d'entrée

```
Date:
Lot:
Composants:
Fichiers modifiés:
Décisions techniques:
Risques restants:
Prochaine étape:
```

### Historique

- Date: 2026-02-20
	Lot: A1 — UI atomique (2 composants)
	Composants: `Input`, `Badge` (en plus du `Button` déjà présent)
	Fichiers modifiés:
	- `ui/src/components/ui/input.tsx`
	- `ui/src/components/ui/badge.tsx`
	- `ui/src/web-components/Input.tsx`
	- `ui/src/web-components/Badge.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	Décisions techniques:
	- Exposition via Web Components (`ui-input`, `ui-badge`) pour usage direct en template Django.
	- Démo centralisée sur `/app/components/` pour validation visuelle rapide.
	Risques restants:
	- Le wrapper générique `createWebComponent` reste basique pour composants complexes à slots riches.
	Prochaine étape:
	- Lot A2: porter `Card` + `Textarea`.

- Date: 2026-02-20
	Lot: A2 — UI atomique (2 composants)
	Composants: `Card`, `Textarea`
	Fichiers modifiés:
	- `ui/src/components/ui/card.tsx`
	- `ui/src/components/ui/textarea.tsx`
	- `ui/src/web-components/Card.tsx`
	- `ui/src/web-components/Textarea.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	Décisions techniques:
	- `ui-card` exposé avec props simples (`title`, `description`, `content`, `footer`).
	- `ui-textarea` expose les props standards et events (`ui-input`, `ui-change`, `ui-focus`, `ui-blur`).
	Risques restants:
	- `Select` et composants avancés (modal/dialog/dropdown) restent à porter.
	Prochaine étape:
	- Lot A3: porter `Select`.

- Date: 2026-02-20
	Lot: A3 — UI atomique (1 composant)
	Composants: `Select`
	Fichiers modifiés:
	- `ui/src/components/ui/select.tsx`
	- `ui/src/web-components/Select.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	Décisions techniques:
	- Implémentation en `select` HTML natif stylé, sans dépendance Radix.
	- Exposition via Web Component `ui-select` avec `options` en JSON.
	Prochaine étape:
	- Lot A4: `Alert`, `Skeleton`.

- Date: 2026-02-20
	Lot: A4 — UI atomique (2 composants)
	Composants: `Alert`, `Skeleton`
	Fichiers modifiés:
	- `ui/src/components/ui/alert.tsx`
	- `ui/src/components/ui/skeleton.tsx`
	- `ui/src/web-components/Alert.tsx`
	- `ui/src/web-components/Skeleton.tsx`
	- `ui/vite.config.ts`
	- `templates/app/components_demo.html`
	Décisions techniques:
	- `Alert` version atomique (`default` / `destructive`) avec `title` + `description`.
	- `Skeleton` avec API minimale (`width`, `height`, `circle`).
	Prochaine étape:
	- Lot B1: premier composant branché DRF.

- Date: 2026-02-20
	Lot: B1 — Liste interactions (lecture)
	Composants: `InteractionList`
	Fichiers modifiés:
	- `ui/src/lib/api/interactions.ts`
	- `ui/src/components/features/InteractionList.tsx`
	- `ui/src/pages/interactions.tsx`
	- `ui/vite.config.ts`
	- `templates/app/interactions.html`
	- `apps/interactions/views_web.py`
	- `apps/interactions/web_urls.py`
	- `config/urls.py`
	Décisions techniques:
	- Service API frontend dédié (`fetchInteractions`) avec pagination DRF.
	- Données initiales préchargées côté serveur pour le premier rendu.
	- États UI: chargement (`Skeleton`), erreur (`Alert`), vide, succès.
	Risques restants:
	- Le contexte household nécessite `X-Household-Id` explicite si multi-households.
	Prochaine étape:
	- Lot B2: formulaire de création.

- Date: 2026-02-20
	Lot: B2 — Formulaire de création interactions
	Composants: `InteractionCreateForm`
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
	Décisions techniques:
	- Composant monté directement dans un `<div>` (pas de Web Component).
	- Données initiales fetch côté serveur (household + zones).
	- Formulaire connecté à `POST /api/interactions/interactions/` avec CSRF + `X-Household-Id`.
	Prochaine étape:
	- Filtres avancés sur `InteractionList`, pagination serveur.
