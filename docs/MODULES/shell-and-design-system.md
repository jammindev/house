# Module — shell-and-design-system

> Audit : 2026-04-28. Rôle : shell applicatif (AppShell, Sidebar, TopBar) + design system + i18n + thèmes.

## État synthétique

- **Périmètre** : layout global (sidebar + topbar + main), composants génériques de page (PageHeader, ListPage, EmptyState, etc.), primitives UI (Button, Input, Card, Dialog, SheetDialog, Toast…), bascule light/dark + color themes, i18n 4 langues (en/fr/de/es).
- **Health** : stable — BUG-02/03/04 résolus (P1, commit `89bd8a1`). BUG-05 vérifié non-bug. Items ouverts : #69 (404/ErrorBoundary), #45 (isLoading redondant).

## Composition

- Shell : `ui/src/components/AppShell.tsx`, `Sidebar.tsx`, `SidebarToggleContext.tsx`, `TopBar.tsx`, `HouseholdSwitcher.tsx`, `ImpersonationBanner.tsx`
- Helpers de page : `PageHeader.tsx`, `ListPage.tsx`, `ListSkeleton.tsx`, `EmptyState.tsx`, `TabShell.tsx`, `CardActions.tsx`, `ConfirmDialog.tsx`
- Design system : `ui/src/design-system/` (button, input, card, dialog, sheet-dialog, dropdown-menu, dropdown-select, select, checkbox-field, form-field, filter-bar, filter-pill, alert, badge, skeleton, separator, label, textarea, toast)
- i18n : `ui/src/lib/i18n.ts` (init i18next, détection lang) + `ui/src/locales/{en,fr,de,es}/translation.json`
- Thèmes : `ui/src/lib/theme.ts` (`applyDarkMode`, `applyColorTheme`), appliqués dans `ProtectedLayout` au chargement du profil
- Tokens CSS : `ui/src/styles.css` (référencé via Tailwind 4)

## Notes

- BUG-05 (sidebar active sur pages de détail) s'avère non-bug : `NavLink` v7 avec `end=false` par défaut fait déjà du prefix-match — *source : commit `89bd8a1` message*
- Bootstrap script dans `templates/index.html` applique `dark` et `color_theme` sur `<html>` avant React — garantit zéro FOUC même sur hard reload
- 4 langues supportées avec fallback `en`. Règle projet : pas de `defaultValue` dans `t()` (CLAUDE.md projet).
- `logout()` ne supprime pas `theme`/`color_theme` de localStorage — le thème persiste entre sessions — *source : `ui/src/lib/auth/context.tsx:74-81`*
