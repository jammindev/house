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

## À corriger (urgent)

- [ ] Page 404 et Error Boundary global absents — une URL invalide n'affiche aucun retour visuel, une erreur JS non catchée crashe l'app sans message utile — *source : #69*
- ~~[#25] Blink de thème au chargement (FOUC)~~ — **RÉSOLU** commit `89bd8a1` : bootstrap script `templates/index.html` applique dark + color_theme avant React
- ~~[#27] Blink de la sidebar au rechargement / navigation~~ — **RÉSOLU** commit `89bd8a1` : `ProtectedLayout` wraps `<Outlet>` dans `<Suspense>`, AppShell reste monté entre les routes

## À faire (backlog)

- [ ] Supprimer les `isLoading` manuels redondants sur les pages qui n'utilisent pas encore `useDelayedLoading` + skeleton (ZonesPage, InteractionsPage, SettingsPage confirmés) — *source : #45*
- [ ] Documenter `useSessionState`, `useDeleteWithUndo`, query key factory dans `docs/` — *source : #53*

## À améliorer

- [ ] LoginPage n'utilise pas `t()` — auditer l'ensemble du shell pour s'assurer qu'aucun libellé ne reste hardcodé
- [ ] Évaluer la mise en place d'un nonce CSP pour retirer `unsafe-inline` de la CSP Nginx — *source : `docs/SECURITY_REVIEW.md` §9*

## Notes

- BUG-05 (sidebar active sur pages de détail) s'avère non-bug : `NavLink` v7 avec `end=false` par défaut fait déjà du prefix-match — *source : commit `89bd8a1` message*
- Bootstrap script dans `templates/index.html` applique `dark` et `color_theme` sur `<html>` avant React — garantit zéro FOUC même sur hard reload
- 4 langues supportées avec fallback `en`. Règle projet : pas de `defaultValue` dans `t()` (CLAUDE.md projet).
- `logout()` ne supprime pas `theme`/`color_theme` de localStorage — le thème persiste entre sessions — *source : `ui/src/lib/auth/context.tsx:74-81`*
