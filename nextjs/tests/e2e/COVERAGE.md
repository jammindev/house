# Playwright E2E Coverage (House)

Parcours actuellement couverts (à maintenir en phase avec les specs) :

- Auth
  - Redirection d’un invité de `/app` vers `/auth/login`.
  - Connexion d’un utilisateur confirmé → accès au dashboard et navigation.

- Interactions (notes)
  - Création d’une note via le sélecteur de type.
  - Validation côté UI : note sans zone → erreur, sujet vide → erreur.
  - Suppression d’une interaction par un autre membre du même foyer.

- Interactions (ex-entries, note form)
  - Liste des interactions du foyer.
  - Création d’une interaction avec sélection de zone.
  - Sélection d’une zone enfant désélectionne le parent.
  - Upload d’une pièce jointe + affichage en détail (documents/photo/PDF list).
  - Suppression d’une pièce jointe par l’uploader.
  - Suppression d’une interaction supprime aussi ses documents (vérifié via API admin).
  - Suppression d’une interaction par un autre membre du foyer (cross-RLS).
  - Validations : blocage si aucune zone ou texte vide.

- Zones
  - Création d’une zone racine + enfant (affichée dans la liste).
  - Renommage + mise à jour surface/note via le dialogue d’édition.
  - Ouverture de l’éditeur avec valeurs pré-remplies.
  - Suppression d’une zone via la modale de confirmation.

Notes d’implémentation :
- Les tests utilisent `supabaseAdmin.ts` pour créer/cleanup users, households, zones, interactions et documents ; chaque test case est isolé (beforeEach/afterEach).
- Les toasts n’étant pas stables, les assertions privilégient la présence des éléments métier (sujets, documents, liens).
- Les uploads s’appuient sur `fixtures/sample.txt` et vérifient la suppression côté DB/Storage.
- Les helpers d’acceptation du bandeau cookies sont intégrés dans les specs (`cookie-accept`).
