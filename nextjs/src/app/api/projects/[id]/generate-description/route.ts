import { NextRequest } from "next/server";
import { AI_DEFAULT_MODEL, buildProjectDescriptionMessages, getOpenAIClient, getProjectContext, isAIEnabled } from "@ai";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

interface GenerateDescriptionRequestBody {
    action: 'generate' | 'update';
    additionalInstructions?: string;
}

export async function POST(
    request: NextRequest,
    { params }: { params: Promise<{ id: string }> }
) {
    try {
        const resolvedParams = await params;
        const projectId = resolvedParams.id;
        const body: GenerateDescriptionRequestBody = await request.json();

        if (!body.action || !['generate', 'update'].includes(body.action)) {
            return Response.json({ error: 'Valid action is required (generate or update)' }, { status: 400 });
        }

        const supabase = await createSSRClient();
        const adminClient = await createServerAdminClient();

        // Get current user with locale preference
        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError || !user) {
            return Response.json({ error: 'Unauthorized' }, { status: 401 });
        }

        // Get user locale from user_metadata or default to 'fr'
        const userLocale = user.user_metadata?.locale || 'fr';

        // Verify project access through household membership
        const { data: project, error: projectError } = await supabase
            .from('projects')
            .select(`
                *,
                households!inner(
                    household_members!inner(user_id)
                ),
                project_groups(
                    name,
                    description
                )
            `)
            .eq('id', projectId)
            .eq('households.household_members.user_id', user.id)
            .single();

        if (projectError || !project) {
            return Response.json({ error: 'Project not found or access denied' }, { status: 404 });
        }

        // Verify OpenAI API key is configured
        if (!isAIEnabled()) {
            return Response.json({ error: 'AI service not configured' }, { status: 503 });
        }

        const projectContext = await getProjectContext({
            supabase,
            project,
            options: {
                interactionsLimit: 50,
                includeEquipment: true,
                includeDocuments: true,
                includeZones: true,
                buildDetailed: true,
            },
        });

        if (!projectContext) {
            return Response.json({ error: "Project context unavailable" }, { status: 404 });
        }

        const messages = buildProjectDescriptionMessages({
            action: body.action,
            context: projectContext.detailed || projectContext.summary,
            locale: userLocale === "en" ? "en" : "fr",
            additionalInstructions: body.additionalInstructions,
            existingDescription: project.description,
        });

        // Get AI response
        const openai = getOpenAIClient();
        const completion = await openai.chat.completions.create({
            model: AI_DEFAULT_MODEL,
            messages,
            max_completion_tokens: 1200, // Increased for longer, more detailed descriptions
        });

        const generatedDescription: string | undefined | null = completion.choices[0]?.message?.content;
        console.log('AI response received:', generatedDescription);

        if (!generatedDescription) {
            return Response.json({ error: 'Failed to generate description' }, { status: 500 });
        }

        // Update the project description in the database
        const { error: updateError } = await adminClient
            .from('projects')
            .update({
                description: generatedDescription,
                updated_at: new Date().toISOString(),
                updated_by: user.id
            })
            .eq('id', projectId);

        if (updateError) {
            console.error('Failed to update project description:', updateError);
            return Response.json({ error: 'Failed to save description' }, { status: 500 });
        }

        return Response.json({
            success: true,
            description: generatedDescription,
            action: body.action
        });

    } catch (error) {
        console.error('Generate description error:', error);
        return Response.json({ error: 'Internal server error' }, { status: 500 });
    }
}
