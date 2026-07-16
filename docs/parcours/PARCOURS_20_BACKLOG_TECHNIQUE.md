# Parcours 20 — Backlog technique

> Issues : **#300** (20.1), **#301** (20.2), **#302** (20.3).
> Découpage d'implémentation du parcours 20 (onglets adaptatifs + photos
> avant/après). Voir `PARCOURS_20_ENRICHIR_LE_DETAIL_PROJET.md` pour le cadrage
> produit. Zéro duplication : la logique d'écriture reste dans les services de
> l'app propriétaire (skill `/new-feature`).

## Lot 20.1 — Onglets adaptatifs (masquer les vides)

**Objectif** : `ProjectDetailPage` n'affiche que les onglets qui ont du contenu ;
`overview` toujours visible ; réapparition automatique dès qu'un contenu est créé.

### Backend

- `apps/projects/serializers.py` — ajouter un champ `tab_counts`
  (`SerializerMethodField`) **uniquement sur le detail** (pas la liste, coût
  inutile). Shape :
  ```json
  {
    "tasks": 3,
    "trackers": 0,
    "notes": 1,
    "expenses": 2,
    "documents": 0,
    "photos": 4,
    "timeline": 6
  }
  ```
  - `tasks` : `Task.objects.filter(project=obj).count()` (scope foyer déjà garanti
    par la FK).
  - `trackers` : trackers liés au projet (voir `TrackersPanel` / `Tracker.project`).
  - `notes` / `expenses` / `timeline` : `Interaction` liées au projet
    (`type='note'`, `type='expense'`, total). Réutiliser le même filtre que
    `useProjectInteractions` (source polymorphe ou FK projet — vérifier
    `ProjectInteractions` view).
  - `documents` : `DocumentLink` vers ce projet dont le document `type != 'photo'`.
  - `photos` : `DocumentLink` vers ce projet dont le document `type == 'photo'`.
- Éviter le N+1 : calculer les counts en quelques requêtes agrégées dans une
  méthode dédiée (`Project.tab_counts()` sur le modèle ou helper dans
  `services.py`), pas 7 `.count()` séquentiels non maîtrisés. Acceptable pour un
  **detail** (objet unique) — ne PAS ajouter à la liste.
- Exposer `tab_counts` dans `fields` du `ProjectSerializer` mais le rendre
  conditionnel au `retrieve` (via `self.context['view'].action == 'retrieve'`) ou
  un serializer detail dédié si plus propre.

### Frontend

- `ui/src/lib/api/projects.ts` + type généré : `Project.tab_counts?: Record<string, number>`.
- `ProjectDetailPage.tsx` :
  - Dériver la liste des onglets visibles depuis `project.tab_counts`. Règle :
    `overview` toujours ; les autres seulement si `count > 0` **OU** onglet
    actuellement actif (évite un onglet fantôme qui disparaît sous le curseur).
  - Passer les `badge` de `TabShell` avec les counts (déjà supporté par
    `TabConfig.badge`).
  - `TabShell` gère déjà le fallback si l'onglet stocké n'existe plus (retour
    `defaultTab`) — rien à changer côté composant.
  - `overview` (`ProjectDashboard`) doit garder ses points d'entrée « créer une
    tâche / une dépense » pour amorcer un projet vide (déjà le cas via
    `onAddTask` + bouton achat du `PageHeader`).
- Invalidation : les mutations (create task, achat, note…) invalident déjà
  `projectKeys` → le detail refetch → `tab_counts` à jour → onglet révélé. Vérifier
  que create task **dans l'onglet tasks** invalide bien le detail projet (sinon
  ajouter `qc.invalidateQueries({ queryKey: projectKeys.detail(id) })`).

### Cas limites

- Onglet actif qui se vide (dernier item supprimé) → reste visible tant qu'il est
  actif ; au prochain changement d'onglet + refetch, il disparaît. Pas d'onglet
  sélectionné fantôme.
- Projet neuf → seul `overview` visible.

### Tests

- Backend : `tab_counts` correct (0 partout sur projet neuf ; incrémenté après
  création tâche/dépense/note/photo).
- E2E : projet neuf n'affiche qu'`overview` + un onglet apparaît après création
  d'une tâche.

---

## Lot 20.2 — Photos avant/après (tag de phase)

**Objectif** : taguer chaque photo liée à un projet avec une phase
(`before`/`during`/`after`), via un onglet Photos dédié.

### Backend

- **Migration** : `DocumentLink.phase = CharField(max_length=16, blank=True,
  default='', choices=[('before',…),('during',…),('after',…)])`. Nullable-vide =
  non classée. Générique (tous entity types), câblé UI projets seulement.
- `apps/documents/services.py` :
  - `link_document(..., phase="")` — persiste la phase à la création du lien.
  - `set_document_phase(*, entity, document_id, phase)` — met à jour la phase du
    lien `(entity, document)`. Valide la phase ∈ choices (ou vide). Retourne le
    lien ou 0 si absent.
- `apps/documents/mixins.py` (`DocumentLinkActionsMixin`) :
  - `attach_document` accepte `phase` (déjà accepte `role`) et le passe au service.
  - Nouvelle action `POST {detail}/set_document_phase/` : `{document_id, phase}` →
    `set_document_phase`. 404 si lien absent, 400 si phase invalide.
- **Exposition en lecture** : le document list serializer renvoie déjà
  `entity_links[]`. Ajouter `phase` sur chaque entrée de lien pour que le front
  connaisse la phase de la photo dans le contexte du projet interrogé.
- `apps/documents/admin.py` : afficher `phase` sur l'inline/admin `DocumentLink`
  (optionnel mais cohérent).

### Frontend

- `ui/src/lib/api/documents.ts` :
  - `EntityLinkSummary` (ou équivalent) : ajouter `phase?: 'before'|'during'|'after'|''`.
  - `attachEntityDocument(..., phase?)` et `setDocumentPhase(entityType, objectId,
    documentId, phase)` (POST `set_document_phase`).
- `ui/src/features/photos/EntityPhotosTab.tsx` (nouveau, calqué sur
  `EntityDocumentsTab`) :
  - Filtre `Document(type=photo)` liés au projet (`fetchPhotoDocuments({ project: id })`
    — vérifier que le filtre `project` s'applique aux photos).
  - Regroupe par phase : Avant / Pendant / Après / Non classées (sections
    `CardTitle` + grille de vignettes, réutiliser `PhotoGrid` si adaptable).
  - Chaque photo : action de tag de phase (dropdown `CardActions` ou pills) →
    `setDocumentPhase` + toast + invalidation.
  - Upload (auto-attaché, phase pré-sélectionnée depuis la section) + attach
    existant, comme `EntityDocumentsTab`.
  - Suppression = détach avec undo (`useDeleteWithUndo`), pattern existant.
- `ProjectDetailPage.tsx` : ajouter l'onglet `photos` dans `TABS` (entre
  `documents` et `timeline`), rendu `<EntityPhotosTab entityType="project"
  objectId={project.id} />`. Compté par `tab_counts.photos` (Lot 1).
- Hooks : `ui/src/features/photos/hooks.ts` — hook `useSetPhotoPhase` (mutation +
  invalidation `photoKeys` et `documentKeys`).

### Cas limites

- Photo déjà liée avant la feature → `phase=''` (Non classées), pas de migration
  de données.
- Retaguer une photo → écrase la phase précédente.
- Une photo peut être liée à plusieurs projets → phase indépendante par lien.

### Tests

- Backend : `set_document_phase` (happy path, phase invalide → 400, lien absent →
  404, scope foyer), `attach_document` avec phase, exposition `phase` en lecture.
- E2E : uploader une photo dans l'onglet Photos, la taguer « après », vérifier
  qu'elle passe dans la section Après.

---

## Lot 20.3 — Comparateur avant/après

**Objectif** : afficher une photo « avant » et une photo « après » côte à côte /
en slider. Purement frontend (consomme la phase du Lot 2).

### Frontend

- `ui/src/features/photos/BeforeAfterCompare.tsx` (nouveau) :
  - Reçoit les photos du projet (déjà chargées par l'onglet Photos).
  - Sélecteurs : quelle photo « avant » / quelle photo « après » comparer (défaut :
    la plus ancienne `before` vs la plus récente `after`).
  - Deux modes : **côte à côte** (desktop) et **slider** (curseur draggable qui
    révèle l'après par-dessus l'avant, tactile mobile). Commencer par le côte à
    côte + un slider simple ; pas de lib externe si un `<input type=range>` +
    `clip-path` suffit.
  - Tokens couleur du design-system uniquement.
- Point d'entrée : bouton « Comparer » dans l'onglet Photos, visible seulement
  s'il existe ≥ 1 photo `before` **et** ≥ 1 photo `after`. Ouvre le comparateur
  (SheetDialog — cf. convention `SheetDialog`, ou inline dans l'onglet).

### États

- Aucune paire (`before`+`after`) → bouton Comparer masqué ; message d'invite dans
  l'onglet Photos.
- Une seule phase présente → afficher la photo dispo + placeholder pour l'autre.

### Tests

- E2E : avec une photo avant + une photo après taguées, ouvrir le comparateur et
  vérifier l'affichage des deux images.

---

## Check anti-duplication (rappel skill `/new-feature`)

- [ ] La phase passe par `documents.services` (jamais l'ORM brut dans la view/mixin).
- [ ] L'onglet Photos réutilise les composants partagés (`Card`, `CardActions`,
  `useDeleteWithUndo`, `PhotoGrid`) — pas de copie de `EntityDocumentsTab`.
- [ ] Un seul client API documents/photos côté UI, consommé via les hooks.
- [ ] Clés i18n : réutiliser `documents.link.*` / `photos.*` avant d'en créer.
