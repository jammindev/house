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

## Mot de passe oublié (`password-reset.spec.ts`)

| Parcours | Statut |
|---|---|
| Lien "Mot de passe oublié ?" depuis /login → /forgot-password | ✅ |
| Demande de reset (email connu) → message générique de succès | ✅ |
| Demande de reset (email inconnu) → même message générique (anti-enum) | ✅ |
| /reset-password sans uid/token → message d'erreur | ✅ |
| Reset complet (token valide) → redirect /login → re-login OK | ✅ |
| Reset avec token invalide → erreur, reste sur /reset-password | ✅ |
| Mots de passe non identiques → erreur de validation client | ✅ |

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

## Carnet de rénovation par zone (`renovation.spec.ts`)

| Parcours | Statut |
|---|---|
| Onglet "Rénovation" visible dans le détail d'une zone | ✅ |
| État vide : EmptyState "Aucune entrée de rénovation" + bouton "Ajouter une entrée" | ✅ |
| Ouverture du RenovationDialog depuis l'EmptyState | ✅ |
| Ouverture du RenovationDialog depuis le bouton d'en-tête | ✅ |
| Formulaire : champs reno-element, reno-type, reno-product, reno-brand, reno-reference, reno-date, reno-subject, reno-notes, Toute la maison, Ajouter | ✅ |
| Création d'une entrée (élément Sol, produit Parquet chêne, marque Panaget) → badge "Sol" + produit/marque visible | ✅ |
| Création d'une entrée avec date → date formatée visible dans la card | ✅ |
| Modification d'une entrée (via CardActions → Modifier → changer produit) → nouvelle valeur visible | ✅ |
| Suppression avec undo (optimistic delete → toast "Entrée supprimée" → Annuler → réapparaît) | ✅ |

---

## Documents

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Upload d'un document | ❌ |

---

## Photos (`photos.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page | ✅ |
| Grille utilise `thumbnail_url` quand des photos existent (fallback `file_url`) | 🚧 (smoke — pas de photo seedée) |
| Téléversement d'une photo depuis la page Photos (dialog en mode photo, sans sélecteur de type) | ✅ |

---

## Interactions

| Parcours | Statut |
|---|---|
| Affichage de la liste | ❌ |
| Création d'une interaction | ❌ |
| Interaction d'expense créée automatiquement par un achat de stock | ✅ (via `stock-purchase.spec.ts`) |

---

## Stock (`stock-purchase.spec.ts`, `stock-item-detail.spec.ts`)

| Parcours | Statut |
|---|---|
| Création d'une catégorie de stock | ✅ |
| Création d'un article de stock | ✅ |
| Approvisionnement d'un article (delta + prix + fournisseur) en un seul geste | ✅ |
| L'achat crée une `Interaction(type=expense)` liée et listée dans `/app/interactions` | ✅ |
| Navigation liste → détail via le titre de la card | ✅ |
| Retour vers la liste via le BackLink (mode "Retour" avec state.back) | ✅ |
| Affichage des infos (nom, statut, catégorie, quantité, fournisseur) sur la page détail | ✅ |
| Section "Historique des achats" vide par défaut | ✅ |
| Enregistrer un achat depuis la page détail → entrée visible dans l'historique | ✅ |
| Suppression depuis la page détail → retour à la liste, article absent | ✅ |
| Accès direct par URL (deep-link) → page se charge, BackLink affiche "Stock" | ✅ |

---

## Équipement (`equipment-purchase.spec.ts`)

| Parcours | Statut |
|---|---|
| Création d'un équipement | ✅ |
| Enregistrement d'un achat (prix + fournisseur, sans delta) en un seul geste | ✅ |
| L'achat crée une `Interaction(type=expense)` liée via la FK polymorphe `source` et listée dans `/app/interactions` | ✅ |

---

## Dépenses (`expenses-summary.spec.ts`, `project-purchase.spec.ts`, `expense-adhoc.spec.ts`)

| Parcours | Statut |
|---|---|
| `/app/expenses` affiche le titre, le total mensuel et le breakdown par type/fournisseur | ✅ |
| Un achat de stock alimente bien la vue dépense (Total + by_kind + by_supplier) | ✅ |
| L'`Interaction(type=expense)` est listée dans la liste des dépenses de la vue | ✅ |
| Quick-add d'une dépense depuis la card d'un projet (« + Dépense ») crée une `Interaction(type=expense, kind='project_purchase')` | ✅ |
| L'expense projet apparaît dans `/app/interactions` ET dans `/app/expenses` | ✅ |
| Quick-add d'une dépense ad-hoc depuis `/app/expenses` (sujet libre, pas de template gettext, `kind='manual'`, `source=None`) | ✅ |
| Validation client : sujet vide refusé sur la dépense ad-hoc | ✅ |

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

## Agent (`agent.spec.ts`)

API mockée (`/api/agent/ask/`) — la couverture du retrieval/LLM côté backend reste pytest.

| Parcours | Statut |
|---|---|
| Affichage de la page + mention de confidentialité au premier usage (input désactivé tant qu'elle n'est pas acceptée) | ✅ |
| Mention de confidentialité non rejouée si déjà acceptée (localStorage) | ✅ |
| Pose d'une question → bulle question + bulle réponse + citation cliquable (label + chip dans la bulle) | ✅ |
| URL de la citation cohérente avec `entity_type` (mapping `equipment:id` → `/app/equipment/id`) | ✅ |
| Réponse "je ne sais pas" → message clair, aucune citation | ✅ |

---

## Notifications (`notifications.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page sans notifications (empty state) | ✅ |
| Badge non-lues affiché sur la cloche | ✅ |
| Ouverture du dropdown depuis la cloche + lien "Voir toutes" | ✅ |
| Marquer toutes les notifications comme lues | ✅ |
| Refus d'une invitation depuis la card (auto mark-as-read) | ✅ |
| Filtrage Toutes / Non lues | ✅ |

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

---

## Électricité — Consommation (`electricity-consumption.spec.ts`)

| Parcours | Statut |
|---|---|
| Onglet Consommation : affiche le bouton "Nouveau compteur" ou la barre compteur | ✅ |
| Création d'un compteur Base depuis l'état vide → barre compteur + boutons apparaissent | ✅ |
| Dialog MeterDialog : contient les champs nom, tarification, n° série, zone, notes | ✅ |
| Saisir un relevé manuel → apparaît dans "Relevés récents" | ✅ |
| Deux relevés avec index croissants → vue Mois affiche la card de total kWh | ✅ |
| Relevé avec index décroissant → erreur visible dans le dialog, pas de création | ✅ |
| Les quatre FilterPills de granularité (Heure / Jour / Mois / Année) sont visibles | ✅ |
| Vue Heure sans import → message dédié "La vue horaire n'affiche que les données importées" | ✅ |
| Vue Jour accessible avec card de total kWh | ✅ |
| Vue Mois accessible avec card de total kWh | ✅ |
| Vue Année accessible avec card de total kWh | ✅ |
| Navigation ◀ change le libellé de période | ✅ |
| Navigation ▶ change le libellé de période | ✅ |
| Bouton "Importer" ouvre le dialog d'import (champ fichier visible) | ✅ |
| Import CSV Enedis → toast "Import terminé : X points ajoutés" | ✅ |
| Après import, vue Heure du jour importé non vide (chart SVG visible) | ✅ |
| Suppression d'un relevé via ⋯ → disparaît immédiatement + toast Annuler | ✅ |
| Undo de la suppression d'un relevé → relevé réapparaît | ✅ |
| Modification d'un relevé via ⋯ → nouvelle valeur visible | ✅ |
| Modification du nom d'un compteur via CardActions → nouveau nom affiché | ✅ |

---

## Électricité — Tarifs (`electricity-tariffs.spec.ts`)

| Parcours | Statut |
|---|---|
| Sans tarif configuré, le bandeau € (dont conso / dont abonnement) est absent | ✅ |
| Ouvrir "Gérer les tarifs" via CardActions du compteur | ✅ |
| Créer un tarif base (prix + abonnement) → apparaît dans la liste | ✅ |
| Après création d'un tarif, le bandeau € "dont conso" apparaît dans la card graphe | ✅ |
| Tarif avec abonnement → "dont abonnement" visible dans le bandeau € | ✅ |
| Modification du prix d'un tarif → nouvelle valeur dans la liste | ✅ |
| Suppression d'un tarif → disparaît immédiatement + toast Annuler | ✅ |
| Undo de la suppression → le tarif réapparaît dans la liste | ✅ |

---

## Eau (`water.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page avec titre "Eau" | ✅ |
| État vide : titre "Aucun relevé" affiché | ✅ |
| Le bouton de l'état vide ouvre le dialog de saisie (champs date + index visibles) | ✅ |
| Fermer le dialog avec "Annuler" | ✅ |
| Créer un premier relevé backdaté (index 1250.5 m³) → apparaît dans la liste | ✅ |
| Deux relevés (index croissants) → card graphe visible avec total m³ | ✅ |
| Titre "Derniers relevés" visible avec des relevés | ✅ |
| Les trois FilterPills de granularité (Jour / Mois / Année) sont visibles | ✅ |
| Vue Mois : card de total m³ visible | ✅ |
| Vue Année : card de total m³ visible | ✅ |
| Navigation ◀ change le libellé de période | ✅ |
| Navigation ▶ change le libellé de période | ✅ |
| Modifier l'index d'un relevé → nouvelle valeur visible dans la liste | ✅ |
| Supprimer un relevé → disparaît immédiatement + toast "Annuler" | ✅ |
| Undo de la suppression → le relevé réapparaît | ✅ |
| Erreur de monotonie : index inférieur au précédent → erreur dans le dialog, dialog reste ouvert | ✅ |

---

## Dashboard (`dashboard.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page : h1 de salutation avec le prénom | ✅ |
| Quick actions principaux visibles (Dépense, Tâche, Note, Demander à l'assistant) | ✅ |
| Card "Ma semaine" toujours affichée | ✅ |
| Données demo de projets actifs visibles ("Rénovation salle de bain") | ✅ |
| Bouton Tâche ouvre le dialog de création | ✅ |
| Créer une tâche (due +3j) via le dashboard → apparaît dans "Ma semaine" + toast "Tâche créée" | ✅ |
| Cocher une tâche dans "Ma semaine" → elle disparaît de la liste + toast avec sujet "terminée" | ✅ |
| Undo de la complétion → la tâche réapparaît dans "Ma semaine" | ✅ |
| Bouton Note navigue vers /app/interactions/new?type=note | ✅ |
| Tâche en retard (-3j) → bloc "À traiter" apparaît | ✅ |
| Item en retard dans "À traiter" est cliquable → navigue vers /app/tasks | ✅ |
| Card Électricité conditionnelle (masquée si aucun compteur dans le main) | ✅ |
| Card Eau conditionnelle (masquée si < 2 relevés dans le main) | ✅ |
| Section "Activité récente" visible si des interactions existent | ✅ |
| Section "Projets actifs" visible + lien "Tous les projets" | ✅ |
| Quick action Expense ouvre ExpenseAdHocDialog | ❌ (déjà couvert dans expense-adhoc.spec.ts) |
| Quick actions conditionnels : Relevé eau / Relevé électricité (visibles si module a des données) | 🚧 (foyer demo sans relevés eau/elec au moment des tests) |

---

## Poulailler (`chickens.spec.ts`)

| Parcours | Statut |
|---|---|
| Affichage de la page avec titre "Poulailler" | ✅ |
| Création d'une poule (nom + race) via le dialog → apparaît dans la grille | ✅ |
| Logger 2 œufs via le bandeau (+/+), toast "Ponte enregistrée", compteur = 2 | ✅ |
| Re-saisir 3 œufs (upsert) → compteur = 3, toujours 1 ligne en DB (pas de doublon) | ✅ |
| Ouvrir la fiche poule depuis l'API, vérifier le titre h1 avec emoji | ✅ |
| Ajouter un événement Soin depuis la fiche → apparaît dans la timeline | ✅ |
| Changer le statut à "Décédée" via le dialog d'édition → badge "Décédée" + événement "Décès" auto dans la timeline | ✅ |
| Supprimer un événement (optimistic delete) → toast "Événement supprimé" → Annuler → réapparaît | ✅ |

---

## Modules & sidebar (`modules-sidebar.spec.ts`)

| Parcours | Statut |
|---|---|
| Épingler un module → section « Épinglés » en tête, item sort de son groupe | ✅ |
| Persistance des épinglés au reload (User.pinned_modules) | ✅ |
| Désépingler → retour dans le groupe d'origine | ✅ |
| Owner désactive un module dans Réglages → disparaît de la sidebar | ✅ |
| URL directe d'un module désactivé → redirect dashboard | ✅ |
| Réactivation → module de retour dans la sidebar | ✅ |
| Section Modules invisible pour un membre non-owner | ✅ |
| Cards dashboard filtrées par modules désactivés | ❌ |

---

## Tutoriel (`tutorials.spec.ts`)

| Parcours | Statut |
|---|---|
| Accès depuis la sidebar (section Compte) → /app/tutorial | ✅ |
| Progression + checklist « Bien démarrer » + grille de guides visibles | ✅ |
| Cocher un item de la checklist → compteur de progression, persistance au reload (User.completed_tutorials) | ✅ |
| Ouvrir un guide → étapes numérotées, marquer terminé/à revoir (toggle), retour à la liste | ✅ |
| Lien « Ouvrir la page » du guide → deep-link vers le module | ✅ |
| Clé de guide inconnue → état vide « Ce guide n'existe pas. » | ✅ |
| Masquage des guides d'un module désactivé | ❌ |

---

## Météo (`weather.spec.ts`)

API `/api/weather/` stubée via `page.route` — aucun appel réseau vers Open-Meteo.

| Parcours | Statut |
|---|---|
| Page non configurée : titre "Météo" + EmptyState "Aucun lieu défini" | ✅ |
| CTA "Définir le lieu" pointe vers /app/settings | ✅ |
| Cliquer sur "Définir le lieu" navigue vers /app/settings | ✅ |
| Page configurée : titre + libellé du lieu en description | ✅ |
| Température actuelle (18°) visible | ✅ |
| Section "Aujourd'hui" avec le ruban horaire visible | ✅ |
| Section "Prévisions sur 7 jours" visible | ✅ |
| Premier jour de prévisions affiché "Auj." | ✅ |
| Lien "Changer de lieu" vers /app/settings | ✅ |
| Message d'erreur quand Open-Meteo indisponible | ✅ |
| Widget Météo affiché sur le dashboard quand configurée | ✅ |
| Widget Météo absent du dashboard quand non configurée | ✅ |
| Cliquer le widget navigue vers /app/weather | ✅ |
| Sidebar affiche un lien "Météo" vers /app/weather | ✅ |
