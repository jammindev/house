# Documentation par module

État de chaque app Django/feature React. Mise à jour : avril 2026.

Chaque fiche suit le même format :

1. **À corriger (urgent)** — bugs ou dettes qui bloquent ou créent de la friction
2. **À faire (backlog)** — features ou évolutions identifiées et non encore commencées
3. **À améliorer** — pistes d'optimisation, qualité de code, UX

Lecture recommandée pour reprendre le projet après pause.

## Apps métier (modèle + API + UI)

- [accounts](./accounts.md) — auth, users, impersonation
- [households](./households.md) — tenancy, invitations
- [zones](./zones.md) — hiérarchie spatiale
- [interactions](./interactions.md) — journal d'événements (cœur métier)
- [documents](./documents.md) — fichiers, OCR, privacy
- [directory](./directory.md) — contacts + structures
- [tags](./tags.md) — tags polymorphes
- [equipment](./equipment.md) — équipements + warranty
- [stock](./stock.md) — inventaire consommables
- [electricity](./electricity.md) — tableau électrique
- [projects](./projects.md) — projets + IA threads
- [tasks](./tasks.md) — tâches + assignation
- [insurance](./insurance.md) — contrats d'assurance
- [notifications](./notifications.md) — notifications user

## Apps frontend / utilitaires

- [photos](./photos.md) — namespace UI
- [app_settings](./app_settings.md) — namespace UI
- [core](./core.md) — modèles abstraits, permissions, middleware

## Apps transverses (frontend / infra)

- [shell-and-design-system](./shell-and-design-system.md) — AppShell, Sidebar, design system, i18n
- [auth-frontend](./auth-frontend.md) — login, JWT, refresh, ProtectedLayout
- [build-and-deploy](./build-and-deploy.md) — Vite, Docker, prod sur Mac Mini

## Voir aussi

- [`docs/JOURNAL_PRODUIT.md`](../JOURNAL_PRODUIT.md) — état des parcours métier
- [`docs/FEATURE_PATTERN.md`](../FEATURE_PATTERN.md) — pattern à suivre pour toute nouvelle feature
- [`AGENTS.md`](../../AGENTS.md) — vue d'ensemble du repo
- **GitHub issues** ([`jammindev/house`](https://github.com/jammindev/house/issues)) — source unique de vérité du backlog
