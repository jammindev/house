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

---

## Électricité (`electricity.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page | ✅ |
| État vide : bouton "Nouveau tableau" visible | ✅ |
| Ouverture du BoardDialog depuis l'état vide | ✅ |
| Création d'un tableau (BoardDialog) | ✅ |
| Présence des nouveaux champs BoardDialog (label, parent, rows, slots) | ✅ |
| Navigation onglet Tableau | ✅ |
| Navigation onglet Circuits | ✅ |
| Navigation onglet Points d'usage | ✅ |
| Navigation onglet Liens | ✅ |
| Navigation onglet Recherche | ✅ |
| Création d'un appareil de protection (disjoncteur) | ✅ |
| Création d'un circuit | ✅ |
| Création d'un point d'usage (prise) | ✅ |
| Création d'un lien circuit → point d'usage | ✅ |
| Filtre "Tous" sur les points d'usage | ✅ |
| Filtre "Prises" sur les points d'usage | ✅ |
| Filtre "Luminaires" sur les points d'usage | ✅ |
| Retour au filtre "Tous" | ✅ |
| Modification d'un appareil via CardActions | ✅ |
| Suppression d'un appareil via CardActions | ✅ |
| Modification d'un point d'usage via CardActions | ✅ |
| Suppression d'un point d'usage via CardActions | ✅ |
| Modification du tableau via CardActions (nom + champ label) | ✅ |
| Onglet Recherche : champ et bouton visibles | ✅ |
| Onglet Recherche : étiquette inexistante → "Introuvable." | ✅ |
| Déconnexion d'un lien via "Déconnecter" | ✅ |
| Création d'un appareil avec position (rangée + slot) | ✅ |
| Affichage du quadrillage des slots (slot grid) quand rangée saisie | ✅ |
| Blocage création si position déjà occupée (conflit détecté en temps réel) | ✅ |
| Position adjacente non conflictuelle acceptée | ✅ |
