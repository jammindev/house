# Module — photos

> Audit : 2026-04-28. Rôle : namespace UI pour visualiser les documents de type photo (les médias passent par `documents`).

## État synthétique

- **Backend** : Absent (pas de modèle propre, app Django minimaliste avec uniquement `apps.py` et templates legacy)
- **Frontend** : Complet dans `ui/src/features/photos/` (`PhotosPage`, `PhotoGrid`, `PhotoThumb`, `PhotoLightbox`, `grouping.ts`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok (namespace `photos` présent dans les 4 locales)
- **Tests** : `grouping.test.ts` + `PhotoLightbox.test.tsx` (vitest)
- **Migrations** : 0

## Modèles & API

- Modèles principaux : aucun — l'app `photos` n'a pas de `models.py`, les photos sont des `Document` filtrés par `type='photo'`
- Endpoints exposés : aucun propre — utilise `GET /api/documents/documents/?type=photo&ordering=-created_at` — *source : `fetchPhotoDocuments`, `ui/src/lib/api/documents.ts`*
- Permissions : héritées de `documents` (IsAuthenticated + IsHouseholdMember)

## Une seule vignette, une seule visionneuse

`PhotoGrid` ne connaît que la géométrie (colonnes, gouttière) ; tout le rendu d'une
image vit dans **`PhotoThumb`**, et son ouverture dans **`PhotoLightbox`**. Les deux
existaient en double (`PhotoGrid` vs le `PhotoTile` de l'onglet par entité) et
avaient divergé. Trois règles en sortent, à ne pas re-perdre :

- **Un échec de chargement est un état, pas une manipulation du DOM.** L'ancien
  `onError` posait `style.display = 'none'` et le repli vivait dans la branche
  `else` du même ternaire — donc jamais atteinte : une miniature cassée laissait
  un carré vide muet.
- **Rien d'essentiel derrière un `hover`.** Le nom de la photo n'apparaissait qu'au
  survol, donc jamais au doigt.
- **Une seule croix de fermeture.** `DialogContent` rend la sienne ; la visionneuse
  passe donc `hideDefaultCloseButton` et pose la sienne dans le panneau de
  métadonnées. Avec les deux, celle de Radix tombait sur l'image sombre en
  `text-foreground` — invisible sur mobile, doublée sur desktop. Régression :
  `PhotoLightbox.test.tsx`.
- **Le libellé destructif vient de l'appelant** (`removeLabel`) : sur la galerie
  l'action supprime le fichier, dans un onglet d'entité elle ne fait que le
  *détacher*. Annoncer « Supprimer » dans le second cas était un mensonge.
- **La visionneuse parcourt la collection dans l'ordre affiché**, pas celui de
  l'API : l'onglet par entité lui passe ses photos aplaties par phase, sinon
  « suivant » sautait d'un « Avant » à un « Après » sans raison lisible.

## Galerie — la date qui compte est celle de la prise de vue

La galerie se range par `Document.taken_at` (EXIF), avec repli sur `created_at`. Le tri
vient du serveur (`ordering=-effective_date`), les en-têtes de mois de
`grouping.ts::effectiveDate` — **les deux appliquent la même règle**, sinon une photo
apparaîtrait sous un en-tête « juillet » entre deux photos de juin et la liste
semblerait mal triée alors que c'est l'étiquette qui mentirait.

La visionneuse dit **« Prise le »** ou **« Ajoutée le »** selon ce qu'elle affiche, et
mentionne l'import à part quand les deux dates s'écartent de plus d'un jour. Les
confondre sous un libellé unique présenterait une date d'import comme une date de prise
de vue. Détail du mécanisme et de ses pièges : section « Date de prise de vue » de
`docs/MODULES/documents.md`.

## Galerie — regroupement par mois et filtres

- Le regroupement passe par `grouping.ts::groupPhotosByMonth`, dont la clé est
  bâtie sur `getFullYear()` / `getMonth()` — **jamais** sur
  `toISOString().slice(0, 7)`. À Paris, une photo du 1er juillet à 00 h 30 est en
  juin en UTC : elle atterrirait sous le mauvais en-tête (même faute que celle que
  `toLocalISODate` corrige pour les bornes de période). Régression :
  `grouping.test.ts`.
- La recherche est debouncée (`lib/useDebouncedValue`) : elle partait à chaque
  caractère frappé.
- **« Aucun résultat » n'est pas « aucune photo ».** `ListPage` masque ses enfants
  quand la liste est vide, donc la barre de filtres avec : on ne lui déclare
  « vide » que la galerie réellement vide, sinon une recherche infructueuse
  effaçait le champ qui l'avait produite et il devenait impossible de revenir en
  arrière.

## Ranger une photo — depuis la photo, et rien qui reste sans zone en silence

`attach_document` ne se pose que **sur une zone** : corriger une photo mal rangée
demandait de deviner où elle était, d'aller dans cette zone, de l'en détacher, puis
d'aller dans la bonne. Trois pièces le règlent, et chacune a une raison de forme :

- **`zone_links` est servi dès la liste** (`DocumentSerializer`, plus seulement le
  détail) : c'est ce qui permet de dire où est une photo et de signaler celle qui
  n'est nulle part. Le coût se paie côté requête — la liste n'est **pas paginée**,
  donc la `GenericForeignKey` de chaque lien est préchargée en bloc
  (`Prefetch('links', queryset=…prefetch_related('entity'))`). Sans ce prefetch
  imbriqué, cinq cents photos rangées coûtaient cinq cents requêtes. Régression :
  `test_photo_zones.py::test_zone_links_cost_a_bounded_number_of_queries`.
- **L'écriture est un remplacement en un appel** :
  `POST /api/documents/documents/{id}/set_zones/ {"zone_ids": [...]}`. Enchaîner
  `detach` + `attach` côté client ferait passer la photo par un instant où elle
  n'est rangée nulle part, et obligerait le client à connaître les anciens liens
  pour les défaire. Une liste vide **efface** les zones — un geste, pas un oubli.
  - Le service ne relie que **ce qui manque** : `link_document` est un upsert qui
    remet `role`/`note`/`phase` à leur défaut, donc ré-enregistrer une zone déjà
    liée effacerait en silence le contexte porté par son lien.
  - Les liens vers d'autres entités (projet, équipement…) ne sont pas touchés :
    l'endpoint ne possède que les liens de type zone. Même règle de portée que
    l'éditeur de ventilation côté argent.
- **La pastille et le filtre lisent la même source.** « Sans zone » se déduit de
  `zone_links` côté vignette et de `?without_zone=1` côté serveur — jamais d'un état
  local. Deux définitions du même manque, et un écran finirait par contredire l'autre
  sur la même photo (même règle que « un écart ne se dit jamais deux fois avec deux
  voix »). Le filtre zone et « sans zone » s'excluent : les cumuler ne rendrait
  qu'une liste vide, sans dire pourquoi.
- **La pastille est réservée à la galerie** (`flagWithoutZone`) : sous l'onglet
  Photos d'une entité la question posée est la phase des travaux, et une pastille de
  plus sur chaque vignette n'y avertirait de rien.
- Un seul formulaire pour l'écriture, `PhotoZonesEditor` — posé dans le panneau de
  la visionneuse (via `renderZones`, injecté : la visionneuse reste sans données
  propres) et dans `PhotoZonesDialog`, ouvert par le menu de la vignette. Le
  brouillon est local et l'enregistrement explicite : en mode multiple, chaque clic
  déclencherait sinon sa propre requête. Il ne se réaligne sur le serveur que quand
  le **contenu** des zones change, sinon un refetch de fond effacerait une
  sélection en cours. Régressions : `PhotoZones.test.tsx`.
- `useSetPhotoZones` invalide `photos`, `documents` **et** `zones` : ranger une
  photo change le `tab_counts.photos` de la zone d'arrivée comme celui de la zone de
  départ.

## Onglet Photos par entité + avant/après (parcours 20)

- `EntityPhotosTab` (`ui/src/features/photos/EntityPhotosTab.tsx`) : onglet photos
  générique, à poser dans le `TabShell` de n'importe quelle entité liable —
  `<EntityPhotosTab entityType="project" objectId={id} />`. Première intégration :
  onglet « Photos » du détail projet.
- Les photos sont regroupées par **phase** (Avant / Pendant / Après / Non classées),
  la phase étant portée par `DocumentLink.phase` (voir `docs/MODULES/documents.md`).
  Upload (auto-attaché, phase présélectionnée depuis la section), retag via le menu
  d'actions de la vignette (`useSetPhotoPhase`), détach avec undo.
- Hooks entité-scopés dans `hooks.ts` : `useEntityPhotos`, `useAttachEntityPhoto`,
  `useDetachEntityPhoto`, `useSetPhotoPhase` (clé `photoKeys.entity(type, id)`,
  invalident aussi `['projects']` pour rafraîchir le compteur d'onglet).
- `BeforeAfterCompare` (`BeforeAfterCompare.tsx`) : comparateur avant/après en
  `SheetDialog` — superpose la photo « après » sur l'« avant » avec un slider
  (`clip-path`, glissement au pointeur sur l'image + `<input type=range>` pour le
  clavier). Bouton « Comparer » visible dans l'onglet seulement si ≥ 1 photo
  `before` **et** ≥ 1 `after`.
  - **`object-cover`, jamais `object-contain`.** Le `clip-path` découpe la *boîte*
    de l'élément, pas l'image visible : avec `contain`, deux photos de ratios
    différents ne remplissaient pas la même surface, le curseur superposait deux
    cadrages distincts et la comparaison mentait.
  - La réinitialisation du curseur ne dépend **que** de `open`. Avec
    `[open, before, after]`, la moindre mutation de phase pendant la comparaison
    recréait les tableaux et ramenait la séparation à 50 %.

## Notes

- **Pas de modèle propre** : `photos` est uniquement un namespace UI, le stockage et l'API passent par l'app `documents` — *source : `apps/photos/` ne contient ni `models.py` ni `views.py` ni `urls.py`*
- Templates legacy présents dans `apps/photos/templates/photos/app/` — vestiges du SSR avant migration SPA
- Le filtrage côté serveur se fait par le paramètre `type=photo` sur l'endpoint documents
- **Miniatures display-only** (PR #94 / issue #93) : génération de 2 tailles JPEG à l'upload via `apps/documents/thumbnails.py` — `thumb` 400×400 crop pour la grille, `medium` 1200 fit pour le `PhotoDetailPanel`. Stockées à `<dir>/.thumbnails/<size>/<file>.jpg`, exposées via `thumbnail_url` / `medium_url` (fallback `file_url` si absentes). Cleanup auto au `post_delete`. Back-fill via `python manage.py regenerate_photo_thumbnails`. **Ces miniatures ne servent PAS à l'IA** — elles sont uniquement pour l'affichage. La normalisation de l'original pour l'OCR/Vision reste à livrer via #88.
