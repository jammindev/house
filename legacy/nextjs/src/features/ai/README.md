# AI Feature

Cette feature centralise la configuration IA, les prompts et la récupération de contexte pour éviter que chaque route/API réinvente ces éléments.

- `config.ts` : modèle/temperature par défaut + détection de clé (`isAIEnabled`).
- `lib/client.ts` : client OpenAI unique (`getOpenAIClient`).
- `lib/context.ts` : helpers pour charger et formatter le contexte projet/foyer (`getProjectContext` → `summary` + `detailed`).
- `lib/redact.ts` : anonymisation basique (emails/téléphones) avant envoi à l'IA.
- `prompts.ts` : builders de messages (`buildInteractionImprovementMessages`, `buildProjectChatMessages`, `buildProjectDescriptionMessages`) + catalogue `AI_PROMPT_DEFINITIONS`.
- `components/` : petits composants UI communs (`AIHelperText`, `AIContextBadge`).
- `index.ts` : point d'entrée unique pour importer la feature (`@ai/...`).

## Usage serveur (exemple)

```ts
import { AI_DEFAULT_MODEL, buildProjectChatMessages, getOpenAIClient, getProjectContext } from "@ai";

const context = await getProjectContext({ supabase, project, options: { interactionsLimit: 25 } });
if (!context) throw new Error("Missing project context");

const messages = buildProjectChatMessages({
  contextSummary: context.summary,
  history,
  userMessage,
});

const openai = getOpenAIClient();
const completion = await openai.chat.completions.create({
  model: AI_DEFAULT_MODEL,
  messages,
  stream: true,
});
```

## Usage UI (exemple)

```tsx
import { AIContextBadge, AIHelperText } from "@ai";

<AIContextBadge label={project.title} meta={project.statusLabel} />
<AIHelperText>Les réponses IA s'appuient sur le contexte du foyer.</AIHelperText>
```

### Notes
- `getProjectContext` accepte `project` déjà chargé (préféré pour éviter un fetch de plus) ou `projectId`.
- Les prompts attendent des contenus déjà “safe”; `redactPII` protège le strict minimum (emails/téléphones) pour rester côté client et serveur.
- Mettez à jour `AI_PROMPT_DEFINITIONS` si vous ajoutez un nouveau flow IA afin d'avoir un inventaire unique.
