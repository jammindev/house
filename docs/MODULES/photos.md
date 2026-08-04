# Module — photos

> Audit : 2026-04-28. Rôle : namespace UI pour visualiser les documents de type photo (les médias passent par `documents`).

## État synthétique

- **Backend** : Absent (pas de modèle propre, app Django minimaliste avec uniquement `apps.py` et templates legacy)
- **Frontend** : Complet dans `ui/src/features/photos/` (`PhotosPage`, `PhotoGrid`, `PhotoThumb`, `PhotoLightbox`, `grouping.ts`, `hooks.ts`)
- **Locales (en/fr/de/es)** : ok (namespace `photos` présent dans les 4 locales)
- **Tests** : `grouping.test.ts`, `PhotoLightbox.test.tsx`, `PhotoZones.test.tsx`,
  `PhotoTitleEditor.test.tsx`, `PhotoSelection.test.tsx`, `TriagePanel.test.tsx`
  (vitest) + `e2e/photos-lightbox.spec.ts` (Playwright)
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
  survol, donc jamais au doigt. Il a d'abord été peint en permanence sur un
  dégradé, puis **retiré de la vignette** : voir « La vignette est la photo » plus
  bas. La règle tient dans les deux sens — ce qui compte ne se cache pas derrière un
  survol, et ce qui ne compte pas ne s'affiche pas partout.
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

## La vignette est la photo, la card de la visionneuse se replie

Deux surcharges vivaient sur **100 %** des cases de la grille : le nom du fichier
peint sur un dégradé (`IMG_4312.jpg` — il n'apprend rien) et la pastille « Sans
zone » avec son libellé. Et en face, la card de la visionneuse disait tout d'un
coup — quatre faits, les notes, l'intention, les zones, trois boutons — devant une
photo qu'on ouvre pour la *regarder*. Ce qui en sort :

- **La vignette ne porte plus que l'image** (plus la coche de sélection, le menu
  d'actions et la pastille de phase, qui répondent à un geste en cours). Le nom
  reste le **nom accessible** du bouton : retiré de l'écran, pas du calque
  d'accessibilité, où il est le seul moyen de désigner une vignette. Régression :
  `PhotoLightbox.test.tsx` (« ne peint pas le nom, mais le garde comme nom
  accessible ») et `PhotoZones.test.tsx`.
- **La card de la visionneuse a deux états.** Repliée : le titre, la date, et
  l'icône « sans zone ». Dépliée : les détails de fichier, les notes, et les trois
  éditeurs — titre, intention, zones — puis télécharger / supprimer. Le pli est un
  **geste, pas un réglage** : il ne survit pas à la fermeture, mais survit au
  passage à la photo suivante (on range plusieurs photos d'affilée), exactement
  comme le retrait du chrome.
- **La pastille « sans zone » n'a pas disparu, elle a déménagé** — de la vignette
  vers la card repliée, réduite à son **icône** (le libellé reste le nom
  accessible et l'infobulle). Même règle que le `flagWithoutSupplier` des
  dépenses : *une pastille n'avertit que là où le manque est actionnable*. Sur la
  grille, elle signalait un manque qu'on ne pouvait pas corriger de là ; sur la
  card, le sélecteur qui le corrige est à un pli. Elle reste **portée par un
  `flagWithoutZone` explicite**, passé par la galerie seule.
- **« Voir » a été supprimé** : il ouvrait dans un onglet la photo déjà affichée en
  plein écran. La clé `photos.view` a été retirée des quatre catalogues.
- **Renommer se fait depuis la photo** (`PhotoTitleEditor` + `useRenamePhoto`,
  injecté via `renderTitle`). Le nom d'un fichier d'appareil est le seul repère
  qui reste d'une photo dans une recherche ou une citation de l'agent, et le
  corriger imposait jusque-là de quitter la galerie pour la fiche document — donc
  personne ne le corrigeait. Même contrat que `PhotoZonesEditor` : brouillon
  local, enregistrement explicite, réalignement quand la visionneuse change
  d'image, et un titre vide refusé plutôt qu'un repère effacé. Régressions :
  `PhotoTitleEditor.test.tsx`.
- **⚠️ La card ne doit pas devenir un conteneur de défilement.** Le sélecteur de
  zones ouvre un panneau `absolute` **non portalisé** : un `overflow-y-auto` sur la
  card le rognerait, et ranger une photo depuis la visionneuse redeviendrait
  impossible sans qu'un pixel ne le dise. C'est le défaut que garde
  `e2e/photos-lightbox.spec.ts`, et il ne se mesure qu'avec un vrai layout.

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
  `zone_links` côté client et de `?without_zone=1` côté serveur — jamais d'un état
  local. Deux définitions du même manque, et un écran finirait par contredire l'autre
  sur la même photo (même règle que « un écart ne se dit jamais deux fois avec deux
  voix »). Le filtre zone et « sans zone » s'excluent : les cumuler ne rendrait
  qu'une liste vide, sans dire pourquoi.
- **La pastille est réservée à la galerie** (`flagWithoutZone`, porté par
  `PhotoLightbox` depuis qu'elle a quitté la vignette — voir « La vignette est la
  photo ») : sous l'onglet Photos d'une entité la question posée est la phase des
  travaux, et rien ne permettrait d'y ranger la photo.
- Un seul formulaire pour l'écriture, `PhotoZonesEditor` — posé dans la card
  **dépliée** de la visionneuse (via `renderZones`, injecté : la visionneuse reste
  sans données propres) et dans `PhotoZonesDialog`, ouvert par le menu de la
  vignette. Le
  brouillon est local et l'enregistrement explicite : en mode multiple, chaque clic
  déclencherait sinon sa propre requête. Il ne se réaligne sur le serveur que quand
  le **contenu** des zones change, sinon un refetch de fond effacerait une
  sélection en cours. Régressions : `PhotoZones.test.tsx`.
- `useSetPhotoZones` invalide `photos`, `documents` **et** `zones` : ranger une
  photo change le `tab_counts.photos` de la zone d'arrivée comme celui de la zone de
  départ.

### Ranger un lot — le lot ajoute, il n'écrase pas

`POST /api/documents/documents/bulk_add_zones/ {"document_ids", "zone_ids"}`, adossé
à `services.add_documents_zones`. Trois règles, et elles ne sont pas symétriques de
celles du geste unitaire :

- **Le lot ajoute.** Les zones choisies complètent celles déjà présentes. Un lot qui
  remplacerait effacerait le rangement de photos qu'on n'a pas regardées une par une,
  et cet effacement ne se verrait nulle part. **Contrepartie assumée : le lot ne sait
  pas *retirer* une zone** — c'est le geste unitaire (`set_zones`) qui le fait. Le
  dialog l'écrit (`photos.zones.bulkHint`) : sans cette phrase, « Enregistrer »
  pourrait tout aussi bien avoir écrasé.
- **Une liste de zones vide est refusée** (400) : ce serait une destruction de masse
  déguisée en raccourci.
- **Tout ou rien.** Un document invisible (autre foyer, privé d'un autre membre)
  refuse le lot entier ; en ranger la moitié laisserait l'utilisateur croire son tri
  fait. Le scope vient de `get_queryset()` — foyer **et** confidentialité — jamais
  refiltré sur place.
- Le coût ne suit pas la taille du lot : une requête établit les liens déjà présents,
  un `bulk_create` pose les manquants. Régression :
  `test_photo_zones_bulk.py::test_the_batch_costs_a_bounded_number_of_queries`.

Côté UI, le mécanisme de sélection est **générique** et vit hors des photos :

- **`ui/src/lib/useMultiSelect.ts`** — mode sélection, toggle, tout sélectionner,
  effacer. Deux garde-fous qui sont du métier, pas de la plomberie : la sélection est
  **dérivée** des ids affichés (un élément qui quitte l'écran quitte la sélection au
  même rendu — une action de masse sur ce qu'on ne voit plus est un dégât qu'aucun
  écran n'explique), et **changer de portée la vide** (`scopeKey` = les filtres :
  cocher douze photos « sans zone » puis basculer sur « Salon » laisserait sinon douze
  cases cochées invisibles). Régressions : `useMultiSelect.test.ts`.
- **`ui/src/components/SelectionBar.tsx`** — barre collante en bas (atteignable au
  pouce quand la grille défile), compteur **fourni** par l'appelant (« 3 photos
  sélectionnées » se dit mieux que « 3 éléments »), actions injectées. La croix
  *quitte le mode* ; « Tout décocher » est un autre geste, porté par le bouton
  bascule.
- Sur la vignette, c'est la **présence** de `onToggleSelected` qui porte le mode —
  pas un booléen de plus, que rien n'empêcherait de contredire l'état réel. En mode
  sélection le menu d'actions disparaît : il disputerait le clic à la coche sur une
  cible de la taille du pouce. La coche est visible cochée **ou non** — une case qui
  n'apparaît qu'au survol laisse croire, au doigt, qu'il n'y a rien à cocher.
- La file « À ranger » de l'argent (`money/PendingQueue.tsx`) porte encore sa propre
  copie de ce mécanisme ; elle peut migrer sans changer de comportement.

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
