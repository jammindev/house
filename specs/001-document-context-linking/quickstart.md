# Quickstart — Traiter un document entrant et le relier au bon contexte

## Prérequis
- Environnement Python actif et dépendances installées.
- Dépendances frontend installées.
- Base de données migrée.
- Un utilisateur membre d’au moins un household.

## 1) Lancer l’application
1. Backend:
   - `source venv/bin/activate`
   - `python manage.py migrate`
   - `python manage.py runserver 8001`
2. Frontend:
   - `npm run dev`

## 2) Vérifier l’entrée minimale du document
1. Ouvrir `/app/documents/`.
2. Cliquer sur l’action d’ajout de document.
3. Depuis `/app/documents/new/`:
   - choisir un fichier,
   - vérifier que le nom est prérempli et modifiable,
   - laisser le type vide ou choisir un type simple,
   - enregistrer.
4. Confirmer qu’après succès l’utilisateur arrive directement sur `/app/documents/<id>/`.
5. Vérifier que le détail affiche un état `sans contexte` et les actions disponibles.

## 3) Vérifier la liste documents
1. Revenir à `/app/documents/`.
2. Confirmer que le document nouvellement créé apparaît dans les récents.
3. Activer le filtre des documents à traiter.
4. Vérifier que le document reste visible tant qu’aucune activité n’est liée.
5. Vérifier qu’un document avec seulement un lien zone/projet reste encore dans ce filtre.

## 4) Vérifier le détail document
1. Ouvrir un document existant via la liste.
2. Confirmer la présence des blocs suivants:
   - identité du document,
   - notes,
   - extrait OCR si présent,
   - contexte actuel,
   - actions principales.
3. Vérifier que les éventuels contextes zone/projet sont visibles en lecture seule.
4. Vérifier que l’ouverture du fichier original fonctionne.

## 5) Vérifier le rattachement à une activité existante
1. Depuis le détail document, ouvrir l’action “Relier à une activité”.
2. Vérifier qu’une liste d’activités récentes est visible immédiatement.
3. Utiliser la recherche simple par libellé si l’activité cible n’est pas dans les récentes.
4. Sélectionner une activité accessible.
5. Confirmer que le lien apparaît tout de suite dans le bloc `Contexte actuel`.
6. Tenter à nouveau de relier le document à la même activité.
7. Vérifier qu’aucun doublon n’est créé et qu’un refus explicite est renvoyé.

## 6) Vérifier la création d’activité depuis le document
1. Depuis le détail document, lancer “Créer une activité depuis ce document”.
2. Vérifier que la page d’ajout d’activité réutilise le flux existant.
3. Vérifier que le document source est passé au flux et que la redirection de succès vise le détail document.
4. Renseigner au moins une zone, conformément aux contraintes actuelles du runtime.
5. Créer l’activité.
6. Vérifier le retour sur `/app/documents/<id>/` avec la nouvelle activité visible.

## 7) Vérifier les contrats API concernés
- `GET /api/documents/documents/`
- `POST /api/documents/documents/upload/`
- `GET /api/documents/documents/{id}/`
- `POST /api/interactions/interaction-documents/`
- `POST /api/interactions/interactions/` avec `document_ids`

Points à confirmer:
- household résolu correctement
- document visible sans contexte tant qu’aucun `InteractionDocument` n’existe
- refus propre d’un doublon exact document-activité
- création atomique activité + lien document

## 8) Tests ciblés
- `pytest apps/documents/tests/test_api_documents.py -v`
- `pytest apps/interactions/tests/test_api_interactions.py -v`

## 9) Vérification i18n
1. Passer l’interface au moins en `fr` et `en`.
2. Vérifier qu’aucune nouvelle chaîne documents n’apparaît en dur dans React.
3. Confirmer que les nouvelles clés existent aussi en `de` et `es` avant livraison.
