- Revoir le design de la modal d'ajout de fichier la prévoir mobile first pour le moment des trucs depassent. 

- Migrer vers react hook form

- Je voudrais que tu normalize le design des pages. Pour cela, prend pour exemple le layout de interaction et créé un composant de layout pour appiquer à storage, zones, contact : pense le mobile first. Ajoute au ssi le boutton action en haut à droite. Pour les pages que je t'ai dit ca sera le boutton ajouter mais je vais reprendre le layout pur d'autre page donc il faut que se soit dynamique et que je puisse mettre n'importe quel icon et action. Sépare bien la logique

-

- Implémenter la nouvelle relation many-to-many entre interactions et documents :
  - Créer la table `interaction_documents` (interaction_id, document_id, role, note, created_at)
  - Migrer les données existantes depuis `documents.interaction_id`
  - Supprimer la colonne `interaction_id` dans `documents`
  - Mettre à jour les modèles ORM et les endpoints API
  - Adapter le front pour permettre de lier un document existant depuis la bibliothèque
  - Vérifier les règles RLS pour assurer l’isolation par foyer