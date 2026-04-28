# Module — tags

> Audit : 2026-04-28. Rôle : tags polymorphes (interaction, document, contact, structure) reliables à n'importe quelle entité via GenericForeignKey.

## État synthétique

- **Backend** : Présent (`Tag` + `TagLink`)
- **Frontend** : Partiel — pas de page dédiée, usage inline via `ui/src/lib/components/TagSelector.tsx` + `ui/src/lib/api/tags.ts` ; aucune route dans `ui/src/router.tsx`. Saisie via input texte séparé par virgules dans `InteractionNewPage` / `InteractionEditPage`.
- **Locales (en/fr/de/es)** : namespace `tags` manquant dans les 4 fichiers (clés tags présentes uniquement comme sous-clés ailleurs : `interactions.tags_label`, `documents.tags_input_*`, etc.)
- **Tests** : oui — 2 fichiers (`test_api_tags.py`, `test_import_supabase_tags.py`)
- **Migrations** : 3

## Modèles & API

- Modèles principaux : `Tag` (HouseholdScopedModel, `type`, `name`, unique `(household, type, name)`), `TagLink` (HouseholdScopedModel, FK `tag` + `GenericForeignKey(content_type, object_id)`)
- Endpoints exposés sous `/api/tags/` : `tags/` (CRUD + filtres `type`, `search` icontains), `tag-links/` (CRUD + filtres `content_type`, `object_id`)
- Permissions : `IsAuthenticated` + `IsHouseholdMember` ; validation cohérence household à chaque création/update de `TagLink` (l'objet lié doit appartenir au même household)

## Notes / décisions produit

- Architecture polymorphe : `TagLink` utilise `ContentType` + `object_id` (CharField 64) pour relier un `Tag` à n'importe quelle entité du household. Les modèles taggés (Interaction, Task) déclarent un `GenericRelation('tags.TagLink', related_query_name='...')`.
- Migration `0003_remove_interactiontag` : ancien modèle `InteractionTag` (FK directe) a été remplacé par le pattern générique. La migration `0002_taglink_generic` crée la nouvelle table.
- Cohérence household : un `TagLink` reprend automatiquement le `household_id` de son `Tag` à `save()` si non fourni (`apps/tags/models.py:72-75`).
- Pas de soft-delete : `Tag` et `TagLink` sont supprimés en dur (cascade sur `Tag` → `TagLink` via `related_name="links"`).
