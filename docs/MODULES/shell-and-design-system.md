# Module — shell-and-design-system

> Audit : 2026-04-27. Rôle : shell applicatif (AppShell, Sidebar, TopBar) + design system + i18n + thèmes.

## État synthétique

- **Périmètre** : layout global (sidebar + topbar + main), composants génériques de page (PageHeader, ListPage, EmptyState, etc.), primitives UI (Button, Input, Card, Dialog, SheetDialog, Toast…), bascule light/dark + color themes, i18n 4 langues (en/fr/de/es).
- **Health** : stable globalement, plusieurs bugs de polish connus sur sidebar et thème (BUG-01 → BUG-05).

## Composition

- Shell : `ui/src/components/AppShell.tsx`, `Sidebar.tsx`, `SidebarToggleContext.tsx`, `TopBar.tsx`, `HouseholdSwitcher.tsx`, `ImpersonationBanner.tsx`
- Helpers de page : `PageHeader.tsx`, `ListPage.tsx`, `ListSkeleton.tsx`, `EmptyState.tsx`, `TabShell.tsx`, `CardActions.tsx`, `ConfirmDialog.tsx`
- Design system : `ui/src/design-system/` (button, input, card, dialog, sheet-dialog, dropdown-menu, dropdown-select, select, checkbox-field, form-field, filter-bar, filter-pill, alert, badge, skeleton, separator, label, textarea, toast)
- i18n : `ui/src/lib/i18n.ts` (init i18next, détection lang) + `ui/src/locales/{en,fr,de,es}/translation.json`
- Thèmes : `ui/src/lib/theme.ts` (`applyDarkMode`, `applyColorTheme`), appliqués dans `ProtectedLayout` au chargement du profil
- Tokens CSS : `ui/src/styles.css` (référencé via Tailwind 4)

## À corriger (urgent)

- [ ] [BUG-01] Perte du thème (light/dark) au logout — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-01* (le `logout()` supprime `theme` indirectement, et `ProtectedLayout` ne réapplique le thème que via `useMe` au prochain login)
- [ ] [BUG-02] Blink de thème au chargement de la page d'accueil (FOUC) — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-02*
- [ ] [BUG-03] La sidebar recharge (re-render complet) au changement de page — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-03*
- [ ] [BUG-04] Blink de la sidebar au rechargement / navigation — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-04*
- [ ] [BUG-05] La sidebar ne met pas en évidence l'entrée active sur les pages de détail — *source : `GITHUB_ISSUES_BACKLOG.md` BUG-05* (`NavLink` `isActive` ne match que sur le path exact)
- [ ] Pré-sélection automatique de la zone parente dans tous les formulaires — créer une zone ancestre unique au household et auto-compléter par défaut côté UI + erreur back si absente — *source : `URGENT.md` (impacte tous les formulaires multi-zones)*

## À faire (backlog)

- [ ] [FEAT-05] Badge compteur d'alertes sur l'entrée Sidebar "Alertes" — *source : `GITHUB_ISSUES_BACKLOG.md` FEAT-05*
- [ ] [DOCS-01] Documenter `useSessionState`, `useDeleteWithUndo`, query key factory dans `docs/` — *source : `docs/ARCHITECTURE_AUDIT_2026_03.md` axe 4, `GITHUB_ISSUES_BACKLOG.md` DOCS-01*
- [ ] [REFACTOR-05] Supprimer les `isLoading` manuels redondants sur les pages qui n'utilisent pas encore `useDelayedLoading` + skeleton — *source : `GITHUB_ISSUES_BACKLOG.md` REFACTOR-05*

## À améliorer

- [ ] LoginPage et ProtectedLayout n'utilisent pas `t()` — auditer l'ensemble du shell pour s'assurer qu'aucun libellé ne reste hardcodé
- [ ] Évaluer la mise en place d'un nonce CSP pour retirer `unsafe-inline` de la CSP Nginx — *source : `docs/SECURITY_REVIEW.md` §9*
- [ ] Mémoïser `Sidebar` (re-render lié à `useTranslation` + `useAuth` à chaque navigation) pour répondre à BUG-03/04
- [ ] Ajouter un script pré-hydratation qui pose `dark` sur `<html>` avant le premier paint (lecture `localStorage.theme`) pour éliminer le FOUC

## Notes

- L'icône calendrier en darkmode est peu lisible (mentionné `TO_FIX.md` l. 16) — concerne le design system (composant date picker / dialog calendar).
- `applyDarkMode` écrit dans `localStorage` à chaque appel, ce qui amplifie le risque de désync au logout.
- 4 langues supportées avec fallback `en`. Règle projet : pas de `defaultValue` dans `t()` (CLAUDE.md projet).
