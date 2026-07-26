# Module — tutorials (page Tutoriel)

> Créé : 2026-07-12. Rôle : onboarding et aide intégrée — page `/app/tutorial`
> (sidebar, section Compte) avec une checklist « Bien démarrer » et un guide pas
> à pas par module, plus une progression par utilisateur. Le contenu est **du
> code** (registre + i18n), pas de la donnée : zéro table de contenu, mise à
> jour en PR via le skill `/tutorials`.

## Deux conventions d'écriture

**Le corps d'une étape est du texte brut, pas du markdown.** `TutorialGuidePage`
l'affiche dans un `<p>` : un `**gras**` s'afficherait littéralement, astérisques
comprises. Pour appuyer une idée, faire une phrase courte et autonome — c'est de
meilleure écriture de toute façon.

**Les sauts de ligne, eux, fonctionnent** (`whitespace-pre-line`). Une étape qui
explique un mécanisme peut donc porter un second paragraphe (« une conséquence à
connaître… »), ce qui évite le pavé.

### Expliquer un mécanisme ≠ décrire un parcours

Le module « Argent » porte quatre guides, et la séparation est volontaire :

- **`money`** répond à « comment l'app raisonne » — le relevé comme vérité, la
  ventilation, les deux axes budget/projet, **la fenêtre de contrôle**, l'arbitrage
  qui périme, et le fait qu'un zéro puisse vouloir dire « non évaluable » ;
- `banking` / `expenses` / `budget` répondent à « quoi cliquer ».

Ce découpage vient d'un vrai incident : un utilisateur a vu une file de rangement
vide avec une coche verte, parce que la date de solde d'ouverture de son compte était
postérieure à ses opérations — la fenêtre de conformité était vide. Le comportement
était correct, l'app ne l'expliquait nulle part. **Un mécanisme contre-intuitif a
besoin d'un guide qui l'énonce**, pas seulement d'un parcours qui l'applique.

## État synthétique

- **Backend** : un seul champ — `User.completed_tutorials` (`apps/accounts/`,
  migration `0012`) : liste JSON de clés opaques (`guide.<key>` /
  `start.<key>`), PATCHée via `/api/accounts/users/me/`. Validation de **forme
  uniquement** (liste de strings ≤ 100 chars, ≤ 500 entrées, dédupliquée) — les
  clés vivent côté frontend, ajouter un guide ne touche jamais le backend.
- **Frontend** : `ui/src/features/tutorials/`
  - `content.ts` — registre typé : `TUTORIAL_GUIDES` (pages transverses + un ou
    plusieurs par module), `GETTING_STARTED`, `GUIDE_ICONS` (précalculés). L'icône
    **explicite gagne** sur celle du module — nécessaire depuis que quatre guides
    partagent le module « Argent », sinon la liste ne se parcourt plus du regard.
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
