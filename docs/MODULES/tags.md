# Module — tags

> Audit : 2026-04-27. Rôle : tags polymorphes (interaction, document, contact, structure) reliables à n'importe quelle entité via GenericForeignKey.

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

## À corriger (urgent)

> Bugs ou dettes qui bloquent l'usage ou créent un risque.

- [ ] BUG-07 — `tags.split(',')` côté `InteractionViewSet.get_queryset` ne nettoie pas les entrées vides → entrées `''` qui faussent le filtre, à remplacer par `[t.strip() for t in tags.split(',') if t.strip()]` — *source : `apps/interactions/views.py:79` ; `GITHUB_ISSUES_BACKLOG.md` BUG-07 ; `docs/SECURITY_REVIEW.md` lignes 128-135*
- [ ] Ajouter le namespace `tags` dans les 4 locales (en/fr/de/es) — actuellement seulement référencé comme sous-clés d'autres namespaces — *source : `ui/src/locales/{en,fr,de,es}/translation.json`*

## À faire (backlog)

> Features identifiées non encore commencées.

- [ ] Page UI dédiée à la gestion des tags (renommer, fusionner, supprimer) — actuellement la création/suppression d'un `Tag` se fait uniquement par effet de bord lors de la saisie d'une interaction — *source : absence dans `ui/src/router.tsx` et `ui/src/features/`*

## À améliorer

> Refacto, perf, UX, qualité de code.

- [ ] `apps/tags/admin.py` : enregistrement minimaliste (`admin.site.register(Tag)` sans config) — ajouter `list_display`, `list_filter`, `search_fields` cohérents avec les autres apps — *source : `apps/tags/admin.py`*
- [ ] Le seul `TagLink.clean()` valide la cohérence household, mais `clean()` n'est pas appelé automatiquement par DRF lors d'un POST — la validation est aujourd'hui répétée dans `views.py:71-85, 97-111`. Possibilité de centraliser dans le serializer.
- [ ] `Tag.TagType` ne couvre que 4 entités (`interaction`, `document`, `contact`, `structure`) alors que `TagLink` est générique — manque potentiellement `task`, `equipment`, `project`, `zone` (si tagging requis sur ces entités) — *source : `apps/tags/models.py:12-16`*

## Notes

- Architecture polymorphe : `TagLink` utilise `ContentType` + `object_id` (CharField 64) pour relier un `Tag` à n'importe quelle entité du household. Les modèles taggés (Interaction, Task) déclarent un `GenericRelation('tags.TagLink', related_query_name='...')`.
- Migration `0003_remove_interactiontag` : ancien modèle `InteractionTag` (FK directe) a été remplacé par le pattern générique. La migration `0002_taglink_generic` crée la nouvelle table.
- Cohérence household : un `TagLink` reprend automatiquement le `household_id` de son `Tag` à `save()` si non fourni (`apps/tags/models.py:72-75`).
- Pas de soft-delete : `Tag` et `TagLink` sont supprimés en dur (cascade sur `Tag` → `TagLink` via `related_name="links"`).
