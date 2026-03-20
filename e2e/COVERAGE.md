# Couverture E2E Playwright

Tests lancés contre `http://localhost:8002` (Django E2E server, DB isolée `house_e2e`).
Données requises : automatique via `npm run test:e2e` (migrate + seed_demo_data).

## Légende

- ✅ Couvert
- ❌ Non couvert
- 🚧 Partiel

---

## Auth (`auth.spec.ts`)

| Parcours | Statut |
|---|---|
| Login avec identifiants valides → dashboard | ✅ |
| Login avec mauvais mot de passe → reste sur /login | ✅ |
| Logout | ❌ |
| Redirect vers /login si non authentifié | ❌ |

---

## Tâches — liste globale (`tasks.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page | ✅ |
| Ouverture du dialog "Nouvelle tâche" | ✅ |
| Création d'une tâche (sujet + zone) | ✅ |
| Modification d'une tâche | ✅ |
| Suppression d'une tâche | ✅ |
| Changement de statut (créateur) | ✅ |
| Ouverture du dialog de détail | ✅ |
| Changement de statut par l'assigné | ✅ |
| Filtrage par statut | ✅ |
| Assignation d'une tâche à un membre | ✅ |
| Création avec date d'échéance dépassée → "En retard" | ✅ |
| Création avec priorité haute → indicateur rouge | ✅ |
| Création d'une tâche privée | ✅ |
| Changement de statut depuis le détail | ✅ |
| Modification depuis le détail | ✅ |

---

## Tâches dans un projet (`project-tasks.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de l'onglet Tâches dans un projet | ✅ |
| Création d'une tâche depuis le panneau projet | ✅ |
| Tâche projet visible dans la liste globale | ✅ |
| Modification d'une tâche depuis le panneau projet | ✅ |
| Changement de statut depuis le panneau projet | ✅ |
| Suppression depuis le panneau projet | ✅ |
| Filtrage par statut dans le panneau projet | ✅ |

---

## Projets

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Création d'un projet | ❌ |
| Navigation vers le détail | ✅ (via project-tasks) |

---

## Zones

| Parcours | Statut |
|---|---|
| Affichage de la hiérarchie | ❌ |
| Détail d'une zone | ❌ |

---

## Documents

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Upload d'un document | ❌ |

---

## Interactions

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Création d'une interaction | ❌ |

---

## Équipements

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Création d'un équipement | ❌ |

---

## Paramètres

| Parcours | Statut |
|---|---|
| Affichage de la page | ❌ |
| Modification du profil | ❌ |
