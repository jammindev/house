# Parcours 29 — Backlog technique

> Cadrage réalisé le 2026-08-03. Aucun code n'a été écrit à ce stade.

## Tableau de bord

| Lot | Sujet | Statut | Issue |
|---|---|---|---|
| 1 | Les dettes qui bloquent le volume — pagination curseur + `size_bytes` en colonne | ⬜ À faire | #527 |
| 2 | L'intention (`purpose`) et la file « À trier » | ⬜ À faire | #528 |
| 3 | Le stockage objet, optionnel | ⬜ À faire | #529 |
| 4 | Le traitement en tâche de fond | ⬜ À faire | #530 |
| 5 | Le quota de stockage du foyer | ⬜ À faire | #531 |
| 6 | L'import massif | ⬜ À faire | #532 |
| 7 | Le géofence — n'envoyer que ce qui a été pris à la maison | ⬜ À faire | #533 |

**Issue parente** : #526 · **Issue annexe (V2 différés)** : #534

## Doc associée

- Doc produit : [PARCOURS_29_ALBUM_DU_FOYER.md](./PARCOURS_29_ALBUM_DU_FOYER.md)
- Fiche concept : [PIPELINE_MEDIA.md](../fiches/PIPELINE_MEDIA.md)
- Fiche module : [docs/MODULES/documents.md](../MODULES/documents.md)
- Fiche connexe : [AUTO_HEBERGEMENT.md](../fiches/AUTO_HEBERGEMENT.md) — la notion
  de capacité optionnelle, dont les lots 3 et 4 dépendent entièrement
- CLAUDE.md, sections « Fraîcheur des données », « Pattern standard — Feature
  page », « Notifications »
- Précédents à répliquer : promotion de colonnes depuis `metadata`
  (`Interaction.amount` / `kind` / `supplier`, `docs/fiches/CARTOGRAPHIE_DEPENSES.md`),
  file « À ranger » de l'argent (`banking.queries`), détecteurs du parcours 26

## Flow cible

1. l'utilisateur ouvre `/app/photos` — la galerie s'ouvre **sur une intention**,
   pas sur tout, et affiche le compte de ce qui reste à trier ;
2. il importe deux cents photos depuis une page d'import dédiée ; la file survit
   à la navigation et se reprend après interruption ;
3. chaque photo est écrite immédiatement, puis traitée en tâche de fond
   (validation, EXIF, normalisation, vignettes, OCR) ; son état est visible ;
4. les nouvelles photos arrivent dans « À trier », regroupées par **session** ;
   une intention s'attribue à la grappe entière ;
5. le compteur de stockage du foyer se met à jour, visible avant de mordre ;
6. depuis le téléphone, la feuille de partage envoie une sélection à House ; une
   automatisation ne propose que ce qui a été pris à la maison.

## Décisions de cadrage

- **Pagination viewset par viewset, jamais globale.** Poser un `PAGE_SIZE` dans
  `REST_FRAMEWORK` changerait la forme des réponses de cinquante-sept viewsets
  d'un coup. Seul `DocumentViewSet` est paginé, et par **curseur** — un import en
  cours décale une pagination par offset et fait sauter des lignes.
- **`size_bytes` est promu en colonne, `metadata['size']` reste écrit.** Un quota
  est une agrégation, et `metadata` doit rester affiché, jamais requêté. La clé
  JSON n'est pas supprimée dans le même lot : une migration destructive se livre
  en deux fois, l'ancien code voyant le nouveau schéma le temps du basculement.
- **Aucun backfill de `purpose`.** Il serait tentant de marquer `technical` toute
  photo déjà liée à un projet ou à un équipement. Ce serait écrire une devinette
  en base, où elle deviendrait indistinguable d'un choix de l'utilisateur —
  exactement ce que `banking.rules` interdit (« des valeurs de départ, jamais des
  vérités »). Tout l'existant part donc dans « À trier ». La contrepartie est
  assumée et rendue tenable par le tri **par grappe** : quelques centaines de
  photos représentent quelques dizaines de gestes, pas quelques centaines.
- **Le stockage objet et le traitement asynchrone sont des capacités déclarées,
  jamais des prérequis.** `MEDIA_BACKEND` et `ASYNC_PROCESSING` se déclarent, sur
  le modèle de `PROTECTED_MEDIA_ACCEL`, et ne se déduisent ni de `DEBUG` ni de la
  présence d'une variable. Une instance auto-hébergée doit continuer de tourner
  en trois conteneurs, sans compte S3 et sans worker.
- **La file de tâches est adossée à Postgres, pas à Redis.** La pile n'a pas de
  Redis et a déjà deux conteneurs `scheduler` : le projet sait faire tourner un
  processus de fond, pas un broker. Choix daté, juste au volume d'un foyer, à
  rejuger si l'échelle change (voir la fiche).
- **L'upload direct déplace la validation, il ne la supprime pas.** Dès que le
  navigateur écrit directement dans le stockage, le serveur ne voit plus les
  octets : `validate_upload` (magic bytes) migre dans le worker, et le document
  reste en **quarantaine** — jamais servi, jamais listé — tant qu'elle n'a pas
  réussi.
- **Le tri se fait par grappe de session**, calculée à la lecture depuis
  `taken_at` (aucune colonne de groupe en base : un regroupement stocké devrait
  être recalculé à chaque correction de date).
- **Le géofence vit sur le téléphone.** Filtrer côté serveur suppose d'avoir déjà
  téléversé — donc payé le stockage et la bande passante pour jeter, et fait
  entrer dans House la position de photos qui ne la concernent pas.

## Lot 1 — Les dettes qui bloquent le volume (#527)

### But

Rendre la galerie et le compteur d'octets tenables **avant** d'ajouter quoi que
ce soit. Aucun changement visible pour l'utilisateur hormis un défilement infini.

### Fichiers

- `apps/documents/pagination.py` *(nouveau)* — `PhotoCursorPagination` : curseur
  sur l'ordre d'affichage de la galerie, `page_size` par défaut et borné.
- `apps/documents/views.py` — `pagination_class` sur `DocumentViewSet`
  **uniquement**.
- `apps/documents/models.py` — `Document.size_bytes`, entier non signé, indexé.
- `apps/documents/migrations/` — deux migrations : le champ, puis le backfill
  idempotent depuis `metadata['size']`.
- `apps/documents/views.py::upload` — renseigne `size_bytes` à la création.
- `ui/src/lib/api/documents.ts` — `fetchPhotoDocuments` / `fetchDocuments`
  consomment le curseur.
- `ui/src/features/photos/hooks.ts`, `PhotosPage.tsx` — `useInfiniteQuery` et
  défilement.

### Critères

1. La galerie d'un foyer à 5 000 photos s'ouvre sans charger les 5 000 lignes.
2. Pendant un import concurrent, le défilement ne duplique ni ne saute de photo
   — **test de régression nommé** : l'ordre du curseur est total.
3. `Sum('size_bytes')` par foyer, sans cast JSON.
4. Le backfill est rejouable et n'écrase pas une valeur déjà juste.
5. Aucun autre viewset ne change de forme de réponse.

## Lot 2 — L'intention (`purpose`) et la file « À trier » (#528)

### But

Donner à une photo la raison de son existence, et rendre visible ce que personne
n'a encore rangé. **C'est le lot qui résout la friction de l'utilisateur.**

### Fichiers

- `apps/documents/models.py` — `Document.purpose` : `technical` / `observation` /
  `memory`, vide autorisé, indexé. Constante `PHOTO_PURPOSES`.
- `apps/documents/migrations/` — le champ, **sans backfill** (voir décisions).
- `apps/documents/serializers.py` — `purpose` en lecture et écriture.
- `apps/documents/views.py` — filtre `?purpose=`, dont un marqueur explicite pour
  « non trié » (ne jamais laisser un paramètre vide signifier « tous »).
- `apps/documents/queries.py` *(nouveau)* — `untriaged(household)` et
  `cluster_sessions(photos, gap)` : regroupement par rafale, calculé à la lecture.
- `apps/documents/views.py` — action de lot `set_purpose` : liste d'identifiants
  + intention, qui **n'écrase jamais** une intention déjà posée sans demande
  explicite.
- `ui/src/features/photos/PhotosPage.tsx` — pastilles d'intention, la galerie
  s'ouvre sur l'une d'elles.
- `ui/src/features/photos/TriagePanel.tsx` *(nouveau)* — la file, par grappes.
- `ui/src/features/photos/hooks.ts` — mutation de lot + invalidation.
- `ui/src/locales/{fr,en,de,es}/translation.json` — `photos.purpose.*`.
- Tutoriels (`/tutorials`) : le guide Photos change de parcours.

### Critères

1. Une photo importée sans intention apparaît dans « À trier », avec son compte.
2. La galerie s'ouvre sur une intention, jamais sur l'ensemble.
3. Trier une grappe de trente photos est **un** geste.
4. Une grappe contenant déjà des intentions le signale et ne les écrase pas —
   **test de régression nommé**.
5. Vide et `memory` ne se confondent nulle part : ni dans un filtre, ni dans un
   compteur, ni à l'écran — **test de régression nommé**.
6. Les quatre catalogues i18n sont à parité (`keys.test.ts` vert).

## Lot 3 — Le stockage objet, optionnel (#529)

### But

Pouvoir ranger les octets ailleurs que sur le disque du serveur, **sans
l'imposer** à qui héberge House chez lui.

### Fichiers

- `requirements/base.txt` — backend de stockage S3-compatible.
- `config/settings/base.py` — `STORAGES` + réglage `MEDIA_BACKEND` déclaré.
- `apps/core/media_urls.py` *(nouveau)* — `media_url(document, variant)` : chemin
  protégé (modes actuels) ou URL présignée courte.
- `apps/core/views_media.py` — un quatrième mode ; **ses trois règles restent
  intactes**.
- `apps/documents/serializers.py` — `file_url` / `thumbnail_url` / `medium_url`
  passent tous par `media_url`.
- `apps/documents/management/commands/migrate_media_storage.py` *(nouveau)* —
  `--dry-run`, idempotente, vérifie taille et empreinte, ne supprime la source
  qu'explicitement.
- `docs/self-hosting/` *(anglais)* — le réglage et son caractère optionnel.

### Critères

1. `MEDIA_BACKEND=local` : comportement strictement identique à aujourd'hui,
   `X-Accel-Redirect` compris.
2. `MEDIA_BACKEND=s3` : les URLs expirent, et un document d'un autre foyer reste
   refusé — **test de régression nommé**.
3. Aucune URL présignée dans un payload persisté, un index de recherche ou une
   notification — **test de régression nommé**.
4. La commande de migration est rejouable et vérifie ce qu'elle a copié.

## Lot 4 — Le traitement en tâche de fond (#530)

### But

Sortir de la requête HTTP tout ce qui n'a pas besoin d'y être.

### Fichiers

- `requirements/base.txt` — file de tâches à broker ORM.
- `config/settings/base.py` — configuration de la file + réglage
  `ASYNC_PROCESSING` déclaré.
- `docker-compose.prod.yml` — conteneur `worker`, sur le modèle des `scheduler`.
- `apps/documents/models.py` — `processing_state` (`pending` / `ready` /
  `failed`) et `processing_error`.
- `apps/documents/tasks.py` *(nouveau)* — `process_document` : validation des
  magic bytes, EXIF (**avant** normalisation), normalisation, vignettes, OCR.
- `apps/documents/views.py::upload` — écrit puis enfile ; **exécute en direct**
  quand `ASYNC_PROCESSING` est faux.
- `ui/src/features/photos/PhotoThumb.tsx` — l'état d'attente, distinct d'une
  erreur.

### Critères

1. En mode asynchrone, l'upload d'une photo de 5 Mo répond sans attendre le
   traitement.
2. Une photo en attente affiche un **état**, jamais une image cassée — **test de
   régression nommé**.
3. Un traitement en échec est visible, nommé, et rejouable.
4. `ASYNC_PROCESSING=False` : comportement d'aujourd'hui, aucun conteneur
   supplémentaire requis.
5. La lecture EXIF précède toujours la normalisation (le test existant de
   `taken_at` doit rester vert après le déplacement).

## Lot 5 — Le quota de stockage du foyer (#531)

### But

Mesurer, montrer, **puis** borner. Aucune facturation.

### Fichiers

- `apps/households/models.py` — le forfait porté par le foyer.
- `apps/households/plans.py` *(nouveau)* — la table des limites, un défaut
  généreux.
- `apps/core/storage_quota.py` *(nouveau)* — `used_bytes(household)` et
  `assert_fits(household, incoming)` : **point d'application unique**, sur le
  modèle de `banking.validators.assert_allocation_fits`.
- `apps/documents/views.py` — l'appel, à l'upload et à l'ingestion.
- `apps/households/views.py` — lecture du compteur.
- `ui/src/features/settings/StorageSection.tsx` *(nouveau)*.
- i18n 4 langues.

### Critères

1. Le compteur mesure l'original **et** la version normalisée **et** les
   vignettes.
2. « Rien mesuré » et « rien envoyé » ne se disent pas pareil — **test de
   régression nommé** (voir « un compteur à zéro a deux sens »).
3. Le dépassement rend un 400 nommé, jamais un 500.
4. Aucun total dénormalisé en base.
5. Aucun code de facturation, d'abonnement ou de paiement.

## Lot 6 — L'import massif (#532)

### But

Deux cents photos en un geste, sans modale, sans perdre le travail en route.

### Fichiers

- `ui/src/features/photos/ImportPage.tsx` *(nouveau)* + route `/app/photos/import`.
- `ui/src/features/photos/importQueue.ts` *(nouveau)* — file persistée côté
  navigateur, reprise après interruption, parallélisme borné.
- `apps/documents/views.py` — `presign_upload` (dépend du lot 3) et
  `complete_upload` (crée la ligne, enfile le traitement).
- `ui/src/features/documents/DocumentUploadDialog.tsx` — reste le chemin des
  petits lots ; renvoie vers la page d'import au-delà d'un seuil.

### Critères

1. Deux cents photos, changement d'onglet au milieu : l'import continue et se
   reprend — **preuve E2E**, ce comportement ne s'atteste pas en jsdom.
2. Un fichier refusé est nommé ; les autres continuent.
3. Le quota est vérifié **avant** de signer, jamais après l'envoi.
4. Le dialogue existant garde son comportement pour un petit lot (tests du
   lot livré en #525 toujours verts).

## Lot 7 — Le géofence : n'envoyer que ce qui a été pris à la maison (#533)

> **Le partage depuis le téléphone a été sorti de ce parcours** le 2026-08-03, pour
> être livré tout de suite sur le mécanisme d'upload existant. Raison : il ne
> dépend d'aucun des lots 1 à 6, et il tient déjà debout — `ActiveHouseholdMiddleware`
> résout le foyer depuis `user.active_household_id` et non depuis un en-tête, donc
> un client authentifié n'a rien d'autre à fournir que son jeton. Ce qui reste ici
> est le seul morceau qui a besoin du reste du parcours : **filtrer ce qu'on
> envoie**, et savoir à l'arrivée si une photo a été prise à la maison.

### But

Enlever le tri manuel des photos rapportées d'ailleurs, sans jamais décider à la
place de l'utilisateur.

### Fichiers

- `apps/documents/exif.py` — lecture des coordonnées **avant** normalisation,
  jamais réécrites dans le fichier stocké.
- `apps/documents/models.py` — `taken_at_home` : booléen **nullable** (inconnu
  n'est pas « non »).
- `apps/documents/queries.py` — le filtre correspondant dans la file « À trier ».
- Documentation de l'automatisation iOS *(anglais)* : *Rechercher des photos* où
  le lieu est proche du domicile, déclenchée à l'arrivée, avec un album iOS dédié
  pour la déduplication.

### Critères

1. Le géofence **pré-sélectionne**, il ne classe jamais : une photo prise
   ailleurs reste importable, une photo prise à la maison n'est pas `technical`
   pour autant.
2. Les coordonnées ne sont jamais réécrites dans le fichier stocké.
3. `taken_at_home` distingue les trois états inconnu / oui / non — **test de
   régression nommé** (une capture d'écran n'a pas de lieu, et ça n'est pas
   « pas à la maison »).
4. Le filtre du géofence est vérifié sur un vrai iPhone : le comportement des
   Raccourcis sur l'EXIF n'est pas supposé, il est constaté (voir le piège déjà
   payé sur `taken_at`).

## Ordre recommandé

`1 → 2 → 3 → 4 → 5 → 6 → 7`

Le lot 1 est un prérequis dur de tous les autres. Le lot 2 apporte la valeur
utilisateur immédiatement après, sans dépendre de l'infrastructure — c'est le
choix de l'utilisateur au cadrage, et il est bon : il résout la friction réelle
avant d'engager le chantier lourd. Les lots 3 et 4 sont indépendants l'un de
l'autre mais tous deux prérequis du lot 6. Le lot 5 peut se glisser dès que le
lot 1 est livré.

## Points de vigilance

- **L'ordre du curseur doit être total.** `effective_date` est un
  `COALESCE(taken_at, created_at)` annoté, pas une valeur unique : deux photos
  d'une même rafale partagent la seconde. Sans départage stable, le curseur saute
  des lignes.
- **Les trois règles de `views_media.py` ne se négocient pas.** Elles ont été
  gagnées sur des incidents de production (dont 177 documents devenus invisibles,
  issue #517). Un quatrième mode s'ajoute à côté ; il n'en réécrit aucune.
- **`read_taken_at` précède `normalize_image`, toujours.** Déplacer ce couple
  dans un worker est exactement l'occasion d'inverser les deux lignes sans que
  rien ne le signale, sauf le test de régression existant.
- **Le front doit déclarer sa fraîcheur.** Toute nouvelle racine de cache passe
  par `DERIVED_FROM` dans `ui/src/lib/invalidate.ts`, et les mutations vivent dans
  le `hooks.ts` de leur feature (`invalidate.test.ts` refuse le reste).
- **La fiche `docs/MODULES/documents.md` porte déjà l'audit du module** ; chaque
  lot doit la mettre à jour, pas la doubler.
- **Le lot 6 rend caduque une partie du dialogue livré en #525** ; ne pas le
  supprimer, il reste le bon chemin pour dix photos.

## Définition de done technique

Pour chaque lot :

1. `pytest` vert, y compris les tests de régression **nommés** dans les critères.
2. `npm run lint` sans erreur et `npx tsc -b ui/tsconfig.json` propre.
3. i18n : les quatre catalogues à parité, aucun `defaultValue` (`keys.test.ts`).
4. `docs/MODULES/documents.md` (et `households.md` pour le lot 5) à jour — pas un
   doublon de ce backlog, l'état du module.
5. Tutoriels mis à jour dès que le parcours utilisateur change (lots 2 et 6 au
   minimum).
6. Le tableau de bord ci-dessus mis à jour (statut + numéro de PR).
7. Pour les lots 3 et 4 : la pile auto-hébergée (`docker compose up`, trois
   conteneurs) démarre et fonctionne **sans** la capacité activée.
