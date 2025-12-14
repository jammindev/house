export const AI_DEFAULT_MODEL = "gpt-4o-mini";
export const AI_DEFAULT_TEMPERATURE = 0.3;

export function isAIEnabled(): boolean {
    return Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== "your_openai_api_key_here");
}
