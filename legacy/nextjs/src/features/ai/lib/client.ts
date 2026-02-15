import OpenAI from "openai";
import { isAIEnabled } from "../config";

let client: OpenAI | null = null;

export function getOpenAIClient(): OpenAI {
    if (!isAIEnabled()) {
        throw new Error("AI service not configured");
    }

    if (!client) {
        client = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
        });
    }

    return client;
}
