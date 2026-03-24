# Audit — Conformité au pattern front standard

> Vérifié le 2026-03-24 contre le pattern défini dans `CLAUDE.md` (TanStack Query, hooks.ts, PageHeader, useDelayedLoading, FilterPill, EmptyState, Card, CardActions, useDeleteWithUndo).

---

## ✅ Pages conformes

| Feature | Page | hooks.ts | Remarques |
|---------|------|----------|-----------|
| Tasks | TasksPage.tsx | ✅ | Référence du pattern |
| Electricity | ElectricityPage.tsx | ✅ | Multi-entités (Boards, Devices, Circuits…) |
| Zones | ZonesPage.tsx | ✅ | |
| Projects | ProjectsPage.tsx | ✅ | Tabs GroupCard + ProjectCard |
| Equipment | EquipmentPage.tsx | ✅ | |
| Stock | StockPage.tsx | ✅ | Tabs catégories + items |
| Documents | DocumentsPage.tsx | ✅ | |
| Interactions | InteractionsPage.tsx | ✅ | |
| Photos | PhotosPage.tsx | ✅ | Grid + panel détail |
| Directory | DirectoryFeaturePage.tsx | ✅ | Dual-entité contacts + structures |

---

## ❌ Pages non conformes

### `AdminUsersPage.tsx`

**Problèmes :**
- Pas de `hooks.ts` — les `useQuery` sont définis inline dans le composant
- Pas de factory de query keys (`adminKeys` / `userKeys`)
- Pas de mutations avec toast + invalidation
- Pas de `useDelayedLoading` / skeleton
- Pas de `EmptyState`
- Pas de `ListPage` wrapper ni de `PageHeader`

**À faire :**
1. Créer `ui/src/features/admin/hooks.ts` avec factory de keys + mutations
2. Extraire la logique de fetch dans les hooks
3. Ajouter skeleton (`useDelayedLoading`) et `EmptyState`
4. Utiliser `PageHeader` + `CardActions` pour les actions utilisateur

---

## ⚠️ Pages exemptées (pattern non applicable)

| Page | Raison |
|------|--------|
| `LoginPage.tsx` | Page d'authentification — flux différent |
| `DashboardPage.tsx` | Page singleton d'overview — pas de liste |
| `SettingsPage.tsx` | Page singleton de configuration — pas de CRUD classique |

---

## Pages de détail (pattern secondaire)

Les pages de détail (`*DetailPage.tsx`) suivent un pattern secondaire cohérent :
`useDelayedLoading` + dialog edit + confirm delete + tabs via `TabShell`.

| Page | Conforme |
|------|---------|
| ZoneDetailPage.tsx | ✅ |
| ProjectDetailPage.tsx | ✅ |
| EquipmentDetailPage.tsx | ✅ |
| DocumentDetailPage.tsx | ✅ |
