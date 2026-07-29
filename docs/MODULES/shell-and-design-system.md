# Module — shell-and-design-system

> Audit : 2026-04-28. Rôle : shell applicatif (AppShell, Sidebar, TopBar) + design system + i18n + thèmes.

## État synthétique

- **Périmètre** : layout global (sidebar + topbar + main), composants génériques de page (PageHeader, ListPage, EmptyState, etc.), primitives UI (Button, Input, Card, Dialog, SheetDialog, Toast…), bascule light/dark + color themes, i18n 4 langues (en/fr/de/es).
- **Health** : stable — BUG-02/03/04 résolus (P1, commit `89bd8a1`). BUG-05 vérifié non-bug. Items ouverts : #69 (404/ErrorBoundary), #45 (isLoading redondant).

## Composition

- Shell : `ui/src/components/AppShell.tsx`, `Sidebar.tsx`, `SidebarToggleContext.tsx`, `TopBar.tsx`, `HouseholdSwitcher.tsx`, `ImpersonationBanner.tsx`
- Helpers de page : `PageHeader.tsx`, `ListPage.tsx`, `ListSkeleton.tsx`, `EmptyState.tsx`, `TabShell.tsx`, `CardActions.tsx`, `ConfirmDialog.tsx`
- Recherche globale : `ui/src/features/search/` (`GlobalSearch.tsx` posé dans la `TopBar`, `SearchPalette.tsx`, `highlight.ts`, `hooks.ts`) — voir « Recherche globale » plus bas
- Design system : `ui/src/design-system/` (button, input, card, dialog, sheet-dialog, dropdown-menu, dropdown-select, select, checkbox-field, form-field, filter-bar, filter-pill, alert, badge, skeleton, separator, label, textarea, toast)
- i18n : `ui/src/lib/i18n.ts` (init i18next, détection lang) + `ui/src/locales/{en,fr,de,es}/translation.json`
- Thèmes : `ui/src/lib/theme.ts` (`applyDarkMode`, `applyColorTheme`), appliqués dans `ProtectedLayout` au chargement du profil
- Tokens CSS : `ui/src/styles.css` (référencé via Tailwind 4)

## Recherche globale (2026-07)

Une seule boîte pour tout ce que contient le foyer, dans la barre du haut : champ sur
desktop (avec ⌘K/Ctrl-K), loupe sur mobile où la barre est déjà pleine. Les deux
ouvrent la même palette (`SheetDialog`), résultats groupés par type d'entité,
navigation ↑↓/Entrée, et un clic **mène à la page** de l'entité (`pushBack`, donc le
lien retour de la page de détail ramène là où la recherche a été lancée).

- **Aucun moteur de recherche n'a été écrit** : la palette appelle
  `GET /api/search/?q=`, qui exécute la retrieval de l'agent
  (`agent.retrieval.search`). Une entité devient donc trouvable en s'enregistrant
  dans `agent.searchables`, sans une ligne de front.
- **La palette, le picker de contexte de l'agent et le tool `search_household`
  passent par le même point d'entrée** (`agent.search_api.search_household_entities`).
  Un utilisateur qui trouve un document dans la barre du haut et s'entend répondre
  « je ne le connais pas » dans le chat n'a aucun moyen de savoir lequel des deux
  ment. Régression : `agent/tests/test_global_search.py::TestTheTwoSearchBoxesAgree`.
- **Le surlignage n'est pas du HTML.** `ts_headline` encadre les termes trouvés de
  `<<…>>` ; `features/search/highlight.ts` les parse en segments rendus en `<mark>`.
  Le contenu vient du foyer (OCR d'un PDF, note) : un `dangerouslySetInnerHTML`
  ferait de chaque `<` saisi un point d'injection.
- **Le catalogue front doit couvrir le registre backend** — icône
  (`features/agent/entityIcons.ts`) et libellé de groupe (`search.entity.*` dans les
  4 locales) pour chaque `entity_type`. Sans ça un nouveau type arrive dans la
  palette avec un glyphe générique et une clé i18n brute. Tenu depuis Python, seul
  côté qui connaît la liste : `test_global_search.py::TestThePaletteCoversTheRegistry`.

## Notes

- BUG-05 (sidebar active sur pages de détail) s'avère non-bug : `NavLink` v7 avec `end=false` par défaut fait déjà du prefix-match — *source : commit `89bd8a1` message*
- Bootstrap script dans `templates/index.html` applique `dark` et `color_theme` sur `<html>` avant React — garantit zéro FOUC même sur hard reload
- 4 langues supportées avec fallback `en`. Règle projet : pas de `defaultValue` dans `t()` (CLAUDE.md projet).
- `logout()` ne supprime pas `theme`/`color_theme` de localStorage — le thème persiste entre sessions — *source : `ui/src/lib/auth/context.tsx:74-81`*
