export { AI_DEFAULT_MODEL, AI_DEFAULT_TEMPERATURE, isAIEnabled } from "./config";
export { getOpenAIClient } from "./lib/client";
export { getProjectContext } from "./lib/context";
export { redactPII } from "./lib/redact";
export { buildInteractionImprovementMessages, buildProjectChatMessages, buildProjectDescriptionMessages, AI_PROMPT_DEFINITIONS } from "./prompts";
export type { AIMessage, ProjectContextResult, ProjectContextOptions } from "./types";
export { AIHelperText } from "./components/AIHelperText";
export { AIContextBadge } from "./components/AIContextBadge";
