# Quickstart — Migration Zones 1:1 Legacy vers Django

## Prérequis
- Environnement Python actif (`venv`) et dépendances installées.
- Dépendances front installées (`npm install`).
- Base de données migrée.

## 1) Lancer l'application
1. Backend:
   - `source venv/bin/activate`
   - `python manage.py migrate`
   - `python manage.py runserver 8000`
2. Frontend (assets Vite):
   - `npm run dev`

## 2) Vérifier la page liste zones
1. Ouvrir `/app/zones/`.
2. Vérifier l'hydratation initiale (données SSR visibles sans interaction).
3. Vérifier CRUD complet:
   - créer zone racine,
   - créer zone enfant,
   - éditer nom/note/surface/couleur,
   - changer parentage,
   - tenter suppression parent avec enfant (doit être refusée avec message explicite),
   - supprimer une feuille (sans enfant).
4. Vérifier rendu arbre et règles couleurs héritées.

## 3) Vérifier la page détail zone
1. Ouvrir `/app/zones/{id}` pour une zone existante.
2. Vérifier:
   - chargement des informations zone,
   - affichage stats,
   - galerie photo (état rempli/vide).
3. Attacher une photo et confirmer l'apparition dans la galerie.

## 4) Vérifier les contrats API
- `GET /api/zones/?household_id=<id>`
- `GET /api/zones/tree/?household_id=<id>`
- `POST /api/zones/`
- `PATCH /api/zones/{id}/`
- `DELETE /api/zones/{id}/`
- `GET /api/zones/{id}/children/`
- `GET /api/zones/{id}/photos/`
- `POST /api/zones/{id}/attach_photo/`

Points à confirmer:
- contexte household correctement appliqué,
- conflit d'édition: update obsolète rejetée (erreur de conflit),
- suppression parent avec enfants refusée.

## 5) Tests ciblés
- `python manage.py migrate`
- `pytest apps/zones -v`

## 6) Contrôle de parité UX
- Comparer les interactions critiques avec la référence legacy:
  - arbre,
  - création/édition/suppression,
  - parentage,
  - couleurs,
  - détail,
  - galerie photo.
