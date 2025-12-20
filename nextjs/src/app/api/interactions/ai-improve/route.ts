import { NextRequest } from "next/server";
import { AI_DEFAULT_MODEL, AI_DEFAULT_TEMPERATURE, buildInteractionImprovementMessages, getOpenAIClient, getProjectContext, isAIEnabled } from "@ai";
import { createSSRClient } from "@/lib/supabase/server";

interface ImproveInteractionBody {
    prompt: string;
    content: string;
    projectId?: string | null;
}

export async function POST(request: NextRequest) {
    try {
        const body: ImproveInteractionBody = await request.json();

        if (!body.prompt?.trim()) {
            return Response.json({ error: "Prompt is required" }, { status: 400 });
        }

        if (!isAIEnabled()) {
            return Response.json({ error: "AI service not configured" }, { status: 503 });
        }

        const supabase = await createSSRClient();
        const {
            data: { user },
            error: userError,
        } = await supabase.auth.getUser();

        if (userError || !user) {
            return Response.json({ error: "Unauthorized" }, { status: 401 });
        }

        const content = (body.content || "").trim();
        const userPrompt = body.prompt.trim();

        let projectContext = null;

        if (body.projectId) {
            projectContext = await getProjectContext({
                supabase,
                projectId: body.projectId,
                options: {
                    interactionsLimit: 10,
                },
            });

            if (!projectContext) {
                return Response.json({ error: "Project not found or access denied" }, { status: 404 });
            }
        }

        const messages = buildInteractionImprovementMessages({
            content,
            userPrompt,
            projectContext: projectContext?.summary,
        });

        const openai = getOpenAIClient();

        const completion = await openai.chat.completions.create({
            model: AI_DEFAULT_MODEL,
            messages,
            temperature: AI_DEFAULT_TEMPERATURE,
            max_completion_tokens: 800,
        });

        const aiResponse = completion.choices[0]?.message?.content?.trim();

        if (!aiResponse) {
            return Response.json({ error: "No AI response generated" }, { status: 500 });
        }

        return Response.json({ html: aiResponse });
    } catch (error) {
        console.error("AI improve interaction error:", error);
        return Response.json({ error: "Internal server error" }, { status: 500 });
    }
}
