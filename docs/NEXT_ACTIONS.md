# Prochaines actions

> Plan de reprise — 2026-04-28. Voir `docs/MODULES/` pour le détail par module.

## Priorité 1 — Hygiène ✅ (2026-04-28)

- [x] Backlog GitHub : déjà poussé avant la session (issues #24-#80)
- [x] Suppression de `URGENT.md`, `TO_FIX.md`, `ELECTRICTY_RETOUR.md`, `TEST.md`, `GITHUB_ISSUES_BACKLOG.md`
- [x] **BUG-01** — déjà fixé (issue #24 close ; bootstrap script lit `localStorage.theme` avant React)
- [x] **BUG-02** — bootstrap applique aussi `localStorage.color_theme` sur `<html>` ; `applyColorTheme` migre body→html et persiste la valeur
- [x] **BUG-03 / BUG-04** — `<Suspense>` autour de l'`Outlet` + AppShell stable pendant `isLoading` (la sidebar ne démontecore plus pendant les nav lazy ni au boot)
- [x] **BUG-05** — non-bug confirmé par `e2e/shell.spec.ts` (NavLink v7 fait du prefix-match par défaut)
- [x] Bonus : `seed_demo_data --flush` fixé (ProtectedError sur ElectricityBoard, issue #83)

## Priorité 2 — Tasks ✅ (2026-04-28)

But : rendre le module le plus utilisé moins frustrant. Détail dans `docs/MODULES/tasks.md`.

- [x] Vérifier la transition `done` (`completed_by` + `completed_at`) end-to-end (tests existants verts)
- [x] Réafficher le toast de suppression (Radix Toast `open` contrôlé + durée gérée par store Zustand)
- [x] Forcer le statut par défaut `pending` à la création (déjà OK dans `NewTaskDialog`)
- [x] Empêcher le flash du layout avant l'empty state (spacer 280px pendant le délai initial)
- [x] Foncer l'icône calendrier en dark mode (`color-scheme: dark` sur les `input[type=date/...]`)

Features module Tasks : déjà implémentées dans `NewTaskDialog` (select `assigned_to` ligne 275-285 + select `project` ligne 287-297).

## Priorité 3 — Zones globales (0,5 jour)

`URGENT.md` : décision « zone ancêtre = foyer » avec auto-attachement et multi-select global. Touche **tous** les formulaires de l'app — à cadrer avant de toucher au reste.

- [ ] À la création d'un household, créer une zone racine immutable
- [ ] Côté backend, auto-rattacher à la racine si aucune zone fournie
- [ ] Côté UI, presélection systématique de la zone parente

## Priorité 4 — Parcours 06 (Alertes proactives) ✅ (2026-04-28)

Données déjà disponibles (`Equipment.warranty_expires_on`, `next_service_due`, tâches en retard). Backlog technique complet dans `docs/parcours/PARCOURS_06_BACKLOG_TECHNIQUE.md`.

- [x] Lot 0 — endpoint `GET /api/alerts/summary/` (`apps/alerts/`, 10 tests verts)
- [x] Lot 1 — section "À surveiller" sur le dashboard (`AlertsSection` dans `DashboardPage`)
- [x] Lot 2 — page Alertes dédiée (`/app/alerts`, 3 sections + état vide)
- [x] Lot 3 — badge dans la sidebar (count temps réel via `useAlertsSummary`)

## À garder en tête (pas urgent)

- **insurance** et **notifications** : modèle + API en place mais zéro UI. À dépiler quand le parcours 06 est livré.
- **directory** : RFC vCard documenté (`docs/SYNC_CONTACTS_STRUCTURES.md`) — Phase 1 export, Phase 2 import.
- **Sécurité post-prod** : `SEC-01` JWT en localStorage → cookie httpOnly, `SEC-02` audit log, `SEC-03` 2FA.
- **Architecture** : déplacer `HouseholdScopedModelSerializer` de `electricity/` vers `core/` (`REFACTOR-03`, ~30 min).

## Outillage disponible

- `/dev` — démarre Django + Vite
- `/gen-api` — régénère les types OpenAPI
- `/translate` — ajoute une clé i18n dans les 4 locales
- Agent `module-auditor` — refresh une fiche `docs/MODULES/<x>.md`
- Agent `django-drf-test-writer` — tests pytest backend
- Agent `playwright-e2e-writer` — tests E2E frontend
