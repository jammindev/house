# Module — tutorials (page Tutoriel)

> Créé : 2026-07-12. Rôle : onboarding et aide intégrée — page `/app/tutorial`
> (sidebar, section Compte) avec une checklist « Bien démarrer » et un guide pas
> à pas par module, plus une progression par utilisateur. Le contenu est **du
> code** (registre + i18n), pas de la donnée : zéro table de contenu, mise à
> jour en PR via le skill `/tutorials`.

## État synthétique

- **Backend** : un seul champ — `User.completed_tutorials` (`apps/accounts/`,
  migration `0012`) : liste JSON de clés opaques (`guide.<key>` /
  `start.<key>`), PATCHée via `/api/accounts/users/me/`. Validation de **forme
  uniquement** (liste de strings ≤ 100 chars, ≤ 500 entrées, dédupliquée) — les
  clés vivent côté frontend, ajouter un guide ne touche jamais le backend.
- **Frontend** : `ui/src/features/tutorials/`
  - `content.ts` — registre typé : `TUTORIAL_GUIDES` (19 guides : pages
    transverses + un par module), `GETTING_STARTED` (6 items), `GUIDE_ICONS`
    (précalculés, icônes héritées de `MODULES` pour les guides à `moduleKey`).
  - `hooks.ts` — `useCompletedTutorials` (Set des clés terminées, cache partagé
    `['settings','me']`), `useToggleTutorial` (mutation optimiste, `next`
    calculé une seule fois avant `onMutate`), `useVisibleTutorials` (masque les
    guides/items des modules désactivés via `useDisabledModules`).
  - `TutorialsPage.tsx` — barre de progression globale, checklist « Bien
    démarrer » (toggle + deep-link « Y aller »), grille de cards de guides
    (badge Terminé).
  - `TutorialGuidePage.tsx` — `/app/tutorial/:key` : étapes numérotées,
    bouton « Ouvrir la page » (deep-link), toggle « Marquer comme terminé » /
    « Marquer à revoir », `BackLink` (fallback `/app/tutorial`), `EmptyState`
    si clé inconnue.
- **Routing/nav** : routes lazy dans `router.tsx` ; entrée sidebar
  `GraduationCap` dans la section Compte, au-dessus de Réglages.
- **Locales (en/fr/de/es)** : namespace `tutorials` (~173 clés par langue) —
  `tutorials.guide.<key>.{title,intro,steps.<stepId>.{title,body}}` et
  `tutorials.start.items.<key>.{title,description}`.
- **Tests** : `apps/accounts/tests/test_completed_tutorials.py` (8 tests API) ;
  `e2e/tutorials.spec.ts` (6 scénarios Playwright : sidebar, checklist,
  progression persistée après reload, guide terminé/rouvert, deep-link, 404).

## Choix de conception

- **Contenu as code** : les tutoriels décrivent le produit, ils évoluent avec
  lui — même PR, même review, même i18n que le code. Pas de CMS, pas d'admin.
- **`stepIds` sémantiques** (`create`, `readings`, `budget`…) : on insère ou
  réordonne des étapes sans renuméroter ni casser les traductions.
- **Progression serveur** (pas localStorage) : suit l'utilisateur d'un appareil
  à l'autre, pattern identique à `pinned_modules`. Clés opaques → les clés de
  progression orphelines après suppression d'un guide sont inoffensives.
- **Complétion manuelle** (pas d'auto-détection « a créé une zone ») : zéro
  couplage avec les modules, coût de maintenance nul ; l'utilisateur coche.

## Maintenance

**Règle projet : toute feature qui change le parcours utilisateur met à jour
les tutoriels dans la même PR.** Procédure, table de décision (nouveau guide vs
nouvelle étape vs item checklist) et script de cohérence registre ↔ 4 locales :
skill `.claude/skills/tutorials/SKILL.md` (étape 4 du skill `/new-feature`).

## À améliorer (pistes)

- Lier la checklist « Bien démarrer » à une détection réelle (ex. cocher
  automatiquement `start.create-zone` quand une zone existe) — à faire
  seulement si le coût de couplage se justifie.
- Chip « Nouveau » sur un guide récemment ajouté (comparaison avec
  `completed_tutorials` + date de livraison changelog).
