# AI Context & Chat — Architecture et plan d'implémentation

> Fichier de référence pour toute IA intervenant sur le système de chat IA contextuel.

## Objectif produit

Permettre à l'utilisateur de poser des questions en langage naturel à une IA qui a accès à **toutes les données du household** : interactions, projets, documents, équipements, zones, contacts, structures. L'IA répond avec des informations précises tirées du contexte réel de la maison.

## Référence legacy (déjà résolu conceptuellement)

Le pipeline complet existe côté legacy Next.js/Supabase :

- **Context builder** : `legacy/nextjs/src/features/ai/lib/context.ts` — fonction `getProjectContext()` qui assemble en parallèle projet + interactions + zones + équipements + documents + notes household
- **Endpoint chat** : `legacy/nextjs/src/app/api/projects/[id]/ai-chat/route.ts` — reçoit la question, appelle le context builder, appelle OpenAI, stream la réponse
- **Hook client** : `legacy/nextjs/src/features/projects/features/ai-chat/hooks/useProjectAIChat.ts`
- **Composants UI** : `legacy/nextjs/src/features/projects/features/ai-chat/components/`

Ces fichiers sont la **référence métier** pour le portage Django. Ne pas copier le code, s'en inspirer.

## Ce qui est déjà porté côté Django

| Élément | Localisation Django |
|---|---|
| Modèles `ProjectAIThread` / `ProjectAIMessage` | `apps/projects/models.py` |
| API threads/messages | `GET\|POST /api/projects/project-ai-threads/` et `/project-ai-messages/` |
| Toutes les données source (interactions, documents, zones, équipements...) | `apps/interactions/`, `apps/documents/`, `apps/zones/`, `apps/equipment/` |
| Scope multi-tenant | `core.HouseholdScopedModel` — toutes les entités ont `household_id` |

## Ce qui reste à construire

### 1. Context builder Python

Fichier cible : `apps/projects/ai_context.py` (ou `apps/core/ai_context.py` si scope global household).

Équivalent de `getProjectContext()`. Doit :

1. Recevoir un `project_id` (ou `household_id` pour un scope global) + des options (`include_documents`, `include_equipment`, `include_zones`...)
2. Agréger via Django ORM (requêtes avec `select_related`/`prefetch_related`)
3. Sérialiser en texte structuré lisible par l'IA (pas en JSON)
4. Retourner un `system_prompt` prêt à envoyer au LLM

Sections du prompt système à produire :
- Contexte household (nom, adresse, `context_notes`, `ai_prompt_context`)
- Projet (titre, description, statut, budget, dates)
- Activité récente (N dernières interactions : type, sujet, date, statut)
- Zones concernées
- Équipements liés (si demandé)
- Documents liés (si demandé)

### 2. Endpoint de chat DRF

`POST /api/projects/{id}/ai-chat/` — action custom sur le ViewSet projets.

Responsabilités :
- Valider la question + le `thread_id` (optionnel, crée un nouveau thread si absent)
- Appeler le context builder
- Appeler le LLM (OpenAI / Anthropic) avec `system_prompt` + historique messages du thread
- Persister le message user et la réponse assistant dans `ProjectAIMessage`
- Streamer la réponse (SSE ou chunked response)

### 3. (Futur) Scope household global

Pour les questions non liées à un projet précis : un endpoint `POST /api/ai/chat/` qui assemble le contexte global du household (dernières interactions toutes apps, projets en cours, équipements...) sans être attaché à un projet.

### 4. (Futur) RAG pour grands volumes

Quand le volume de données dépasse la fenêtre de contexte du LLM, envisager des embeddings vectoriels (pgvector) pour récupérer les N passages les plus pertinents. Non prioritaire — l'approche contexte structuré en texte couvre 80% des cas pour un household.

## Champ `ai_prompt_context` sur le household

Le legacy avait ce champ sur le modèle `Household` pour stocker un contexte personnalisé (description de la maison, particularités...). Vérifier s'il est présent dans `apps/households/models.py`, sinon l'ajouter lors du portage.

## Pattern d'implémentation recommandé

```
apps/projects/
    ai_context.py      ← context builder (à créer)
    ai_views.py        ← endpoint chat DRF (à créer)
    models.py          ← ProjectAIThread, ProjectAIMessage (existant)
    serializers.py     ← sérialiseurs thread/message (existant)
    urls.py            ← ajouter l'action ai-chat au router
```

## Sécurité

- Toujours vérifier `IsHouseholdMember` avant d'assembler le contexte
- Ne jamais exposer de données d'un household différent de celui de l'utilisateur connecté
- Le `system_prompt` ne doit pas contenir de données brutes de mots de passe ou tokens
- Valider et tronquer la question utilisateur avant de l'envoyer au LLM (limite de tokens)
