# Quickstart — Module Électricité Maison (MVP)

## Prérequis
- Environnement Python du repo activé
- Dépendances backend installées (`requirements.txt`)
- Dépendances frontend installées (`npm install`)

## 1) Créer la mini-app Django
1. Ajouter l’app `electricity` (models, serializers, views, urls, admin, tests).
2. Déclarer l’app dans `INSTALLED_APPS`.
3. Brancher les routes API sous `config/urls.py` via `path("api/electricity/", include("electricity.urls"))`.
4. Ajouter la route HTML `path("app/electricity/", app_electricity_view, name="app_electricity")`.

## 2) Implémenter le modèle métier
1. Créer les tables:
   - `ElectricityBoard`
   - `ResidualCurrentDevice`
   - `Breaker`
   - `ElectricCircuit`
   - `UsagePoint`
   - `CircuitUsagePointLink` (soft delete)
   - `PlanChangeLog`
2. Ajouter les contraintes:
   - unicité repère par foyer (global types)
   - un circuit -> un disjoncteur
   - un point d’usage -> un seul lien actif
   - phase obligatoire si triphasé
3. Générer et appliquer migrations.

## 3) Implémenter API DRF
1. Créer viewsets + serializers avec household scoping.
2. Permissions:
   - lecture membre du foyer
   - écriture owner uniquement
3. Ajouter endpoint de lookup bidirectionnel (`/mapping/lookup/`).
4. Ajouter endpoint de désactivation (`/links/{id}/deactivate/`).

## 4) Implémenter la page Django template-first
1. Créer `templates/app/electricity.html`.
2. Construire le contexte complet côté vue (`electricity_page_props` + sections SSR).
3. Rendre le fallback SSR sans JS.

## 5) Ajouter le nœud React ciblé
1. Créer composant `frontend/src/electricity/ElectricityBoardNode.tsx`.
2. Créer entry `frontend/src/electricity/mount-electricity.tsx`.
3. Monter le composant dans le template via props JSON injectées depuis la vue Django.

## 6) Vérifier localement
1. Démarrer backend: `python manage.py runserver 8000`
2. Démarrer frontend: `npm run dev`
3. Ouvrir `/app/electricity/`
4. Vérifier:
   - lecture membre OK
   - écriture owner OK
   - écriture membre refusée
   - lookup bidirectionnel OK
   - soft delete associations OK

## 8) Scénario end-to-end documenté (T038)

1. Se connecter avec un owner du foyer A.
2. Créer un board puis 2 disjoncteurs, 3 circuits, 4 points d’usage.
3. Créer des liens `circuit -> point d’usage` (un seul lien actif par point).
4. Ouvrir `/app/electricity/` et vérifier sections SSR (circuits, disjoncteurs, liens actifs).
5. Effectuer un lookup par repère disjoncteur puis par repère point d’usage.
6. Désactiver un lien via `POST /api/electricity/links/{id}/deactivate/`.
7. Vérifier apparition du lien dans la section "liens inactifs" + entrée "recent changes".
8. Se connecter avec un member du foyer A:
   - lecture des endpoints et lookup autorisés
   - POST/PATCH/DELETE refusés (403)
9. Se connecter avec un user hors foyer A:
   - accès aux données du foyer A refusé (403/404 selon endpoint)

## 9) Mesures SC (T039)

### SC-001 — Création plan initial < 15 min

- Chronométrage: démarrer au premier POST board, arrêter après création des liens actifs.
- Données minimales: 1 board, 2 breakers, 3 circuits, 4 usage points, 4 liens.
- Cible: `duration_seconds < 900`.

### SC-002 — Lookup bidirectionnel < 10 s

- Mesurer 20 requêtes lookup successives (`mapping/lookup`) sur labels existants.
- Cible: p95 `< 10s` (en local attendu très inférieur).

### SC-003 — Accès hors foyer bloqué à 100%

- Exécuter un lot de requêtes lecture/écriture avec household non-membre.
- Cible: 100% des écritures refusées et aucune donnée sensible exposée.

### SC-004 — Cohérence des modifications >= 90%

- Vérifier automatiquement: unicité globale des repères, un seul lien actif par point, conflits de suppression.
- Cible: taux de règles satisfaites `>= 90%` sur le scénario de test.

## 7) Tests minimaux à ajouter
- API permissions owner/member
- contraintes de cardinalité et unicité
- soft delete et non-régression lookup
- rendu template avec contexte serveur minimal
