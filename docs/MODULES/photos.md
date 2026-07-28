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
