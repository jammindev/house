import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
});

interface GenerateDescriptionRequestBody {
    action: 'generate' | 'update';
    additionalInstructions?: string;
}

// Helper function to redact PII
function redactPII(text: string): string {
    // Redact email patterns
    const emailRedacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');

    // Redact phone patterns (basic)
    const phoneRedacted = emailRedacted.replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE_REDACTED]');

    return phoneRedacted;
}

// Enhanced function to get comprehensive project context
async function getProjectContext(supabase: any, project: any): Promise<string> {
    // Get household information with context
    const { data: household } = await supabase
        .from('households')
        .select('name, address, city, country, context_notes, ai_prompt_context')
        .eq('id', project.household_id)
        .single();

    // Get zones information
    const { data: zones } = await supabase
        .from('zones')
        .select('id, name, note, surface')
        .eq('household_id', project.household_id);

    // Get project interactions with zones
    const { data: interactions } = await supabase
        .from('interactions')
        .select(`
            id,
            subject,
            content,
            type,
            status,
            occurred_at,
            tags,
            metadata,
            interaction_zones!inner(
                zones(id, name)
            )
        `)
        .eq('project_id', project.id)
        .order('occurred_at', { ascending: false })
        .limit(50);

    // Get equipment related to project zones
    const projectZoneIds = interactions?.flatMap((i: any) =>
        i.interaction_zones?.map((iz: any) => iz.zones?.id)
    ).filter(Boolean) || [];

    const { data: equipment } = await supabase
        .from('equipment')
        .select(`
            id,
            name,
            category,
            manufacturer,
            model,
            status,
            condition,
            purchase_date,
            warranty_expires_on,
            maintenance_interval_months,
            last_service_at,
            next_service_due,
            tags,
            notes,
            zones(name)
        `)
        .eq('household_id', project.household_id)
        .in('zone_id', projectZoneIds);

    // Get documents related to the project
    const { data: documents } = await supabase
        .from('documents')
        .select(`
            id,
            name,
            type,
            mime_type,
            notes,
            created_at,
            interactions!inner(id, subject, project_id)
        `)
        .eq('interactions.project_id', project.id);

    // Format household context information
    const householdInfo = household ? `
HOUSEHOLD CONTEXT:
- Name: ${household.name}
${household.address ? `- Address: ${household.address}` : ''}
${household.city ? `- City: ${household.city}` : ''}
${household.country ? `- Country: ${household.country}` : ''}
${household.context_notes ? `- General Context: ${household.context_notes}` : ''}
${household.ai_prompt_context ? `- AI Context: ${household.ai_prompt_context}` : ''}
` : '';

    // Format project information
    const projectInfo = `
PROJECT DETAILS:
- Title: ${project.title}
- Type: ${project.type || 'Not specified'}
- Status: ${project.status}
- Priority: ${project.priority}/5
- Start Date: ${project.start_date || 'Not set'}
- Due Date: ${project.due_date || 'Not set'}
- Planned Budget: €${project.planned_budget || 0}
- Actual Cost: €${project.actual_cost_cached || 0}
- Tags: ${project.tags?.join(', ') || 'None'}
- Current Description: ${project.description || 'None'}
- Group: ${project.group?.name || 'No group'}
- Created: ${project.created_at}
- Last Updated: ${project.updated_at}
`;

    // Format zones information
    const zonesInfo = zones?.length > 0
        ? `
ZONES INVOLVED:
${zones.map((zone: any, i: number) =>
            `${i + 1}. ${zone.name}${zone.surface ? ` (${zone.surface}m²)` : ''}${zone.note ? ` - ${zone.note}` : ''}`
        ).join('\n')}`
        : '\nZONES INVOLVED: None specified';

    // Format interactions by type
    const interactionsByType = interactions?.reduce((acc: any, interaction: any) => {
        if (!acc[interaction.type]) acc[interaction.type] = [];
        acc[interaction.type].push(interaction);
        return acc;
    }, {}) || {};

    const interactionsInfo = Object.keys(interactionsByType).length > 0
        ? `
PROJECT ACTIVITIES:
${Object.entries(interactionsByType).map(([type, items]: [string, any]) =>
            `
${type.toUpperCase()} (${items.length} items):
${items.slice(0, 10).map((item: any, i: number) =>
                `  ${i + 1}. ${item.subject} - Status: ${item.status || 'N/A'} (${item.occurred_at?.split('T')[0] || 'No date'})
     ${item.content ? `     Details: ${item.content.substring(0, 150)}${item.content.length > 150 ? '...' : ''}` : ''}
     ${item.tags?.length ? `     Tags: ${item.tags.join(', ')}` : ''}
     ${item.interaction_zones?.length ? `     Zones: ${item.interaction_zones.map((iz: any) => iz.zones?.name).join(', ')}` : ''}`
            ).join('\n')}`
        ).join('\n')}`
        : '\nPROJECT ACTIVITIES: No activities recorded';

    // Format equipment information
    const equipmentInfo = equipment?.length > 0
        ? `
RELATED EQUIPMENT:
${equipment.map((eq: any, i: number) =>
            `${i + 1}. ${eq.name} (${eq.category})${eq.manufacturer ? ` by ${eq.manufacturer}` : ''}
   Status: ${eq.status} | Condition: ${eq.condition || 'Not specified'}
   Zone: ${eq.zones?.name || 'Unassigned'}
   ${eq.warranty_expires_on ? `Warranty expires: ${eq.warranty_expires_on}` : ''}
   ${eq.next_service_due ? `Next service: ${eq.next_service_due}` : ''}
   ${eq.notes ? `Notes: ${eq.notes}` : ''}`
        ).join('\n')}`
        : '\nRELATED EQUIPMENT: None found';

    // Format documents information
    const documentsInfo = documents?.length > 0
        ? `
PROJECT DOCUMENTS:
${documents.map((doc: any, i: number) =>
            `${i + 1}. ${doc.name} (${doc.type}) - ${doc.mime_type}
   ${doc.notes ? `Notes: ${doc.notes}` : ''}
   Created: ${doc.created_at?.split('T')[0]}`
        ).join('\n')}`
        : '\nPROJECT DOCUMENTS: None attached';

    return redactPII(householdInfo + projectInfo + zonesInfo + interactionsInfo + equipmentInfo + documentsInfo);
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
        if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
            return Response.json({ error: 'AI service not configured' }, { status: 503 });
        }

        // Get comprehensive project context
        const projectContext = await getProjectContext(supabase, project);

        // Create system prompt based on action
        const languageInstruction = userLocale === 'fr'
            ? 'Écrivez en français.'
            : 'Write in English.';

        const additionalContext = body.additionalInstructions
            ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${body.additionalInstructions}`
            : '';

        // For update action, highlight the existing description
        const currentDescriptionContext = body.action === 'update' && project.description
            ? `\n\nCURRENT DESCRIPTION TO IMPROVE:\n"${project.description}"`
            : '';

        const systemPrompt = body.action === 'generate'
            ? `You are an expert household project manager with excellent writing skills. Create an engaging, well-structured project description that tells the story of this project.

IMPORTANT: The project title, type, status, priority, dates, and budget are already displayed as badges/metadata in the UI. DO NOT repeat this information in the description. Focus on the narrative content.

OUTPUT FORMAT: Use clean markdown formatting with these elements only:
- **Bold text** for emphasis and key points
- ## Headings for main sections (use ## for sections, ### for subsections)  
- - Bullet points for lists when necessary
- Plain text for paragraphs
- NO code blocks, tables, or complex formatting

TASK: Write a compelling project description that includes:
1. An engaging introduction that sets the context and vision
2. Project scope and methodology (what will be done and how)
3. Current status and recent developments
4. Key challenges, considerations, or special requirements
5. Next steps and upcoming milestones

STYLE GUIDELINES:
- Write in a narrative, engaging tone while remaining professional
- Use varied sentence structures and smooth transitions
- Structure content with clear paragraphs and logical flow
- Make it pleasant and easy to read (like a well-written article)
- Include specific details but present them elegantly
- Use active voice and descriptive language
- ${languageInstruction}
- Aim for 300-500 words for comprehensive coverage
- Use markdown formatting for better readability
- Create a description that stakeholders will enjoy reading
- Do NOT repeat the project title, status, dates, budget, or priority information

FORMATTING EXAMPLE:
## Project Overview
[Engaging introduction paragraph...]

**Key Objectives:**
- First objective
- Second objective

## Scope and Methodology
[Detailed explanation...]

**Current Focus:** [Important current activities...]

## Next Steps
[Upcoming milestones and actions...]

PROJECT INFORMATION:
${projectContext}${currentDescriptionContext}${additionalContext}`
            : `You are an expert household project manager with excellent writing skills. Transform the existing project description into a more engaging, well-structured narrative.

IMPORTANT: The project title, type, status, priority, dates, and budget are already displayed as badges/metadata in the UI. DO NOT repeat this information in the description.

OUTPUT FORMAT: Use clean markdown formatting with these elements only:
- **Bold text** for emphasis and key points
- ## Headings for main sections (use ## for sections, ### for subsections)
- - Bullet points for lists when necessary  
- Plain text for paragraphs
- NO code blocks, tables, or complex formatting

TASK: Rewrite and enhance the description to be:
1. More engaging and pleasant to read
2. Better structured with clear flow
3. Enriched with current project information
4. Professional yet accessible

ENHANCEMENT GUIDELINES:
- Improve readability and narrative flow
- Reorganize information for better structure
- Add missing details from recent activities
- Enhance tone while keeping professional standards
- Use descriptive language and varied sentence structures
- Create smooth transitions between topics
- Make technical information more accessible
- ${languageInstruction}
- Aim for 300-500 words
- Use markdown formatting for better readability
- Transform lists into flowing narrative when possible
- Remove repetitive project metadata (title, status, dates, budget)
- Build upon the existing description while improving it significantly

FORMATTING EXAMPLE:
## Project Overview
[Enhanced introduction...]

**Progress Update:** [Current status...]

## Key Activities
[Structured activities section...]

**Upcoming Priorities:**
- Priority one
- Priority two

PROJECT INFORMATION:
${projectContext}${currentDescriptionContext}${additionalContext}`;

        const userMessage = `Please ${body.action === 'generate' ? 'generate' : 'update'} a project description based on the provided information.`;
        console.log('User message to AI:', userMessage);
        console.log('System prompt:', systemPrompt);

        // Get AI response
        const completion = await openai.chat.completions.create({
            model: "gpt-4o-mini",
            messages: [
                {
                    role: "system",
                    content: systemPrompt
                },
                {
                    role: "user",
                    content: userMessage
                }
            ],
            temperature: 0.3,
            max_tokens: 1200, // Increased for longer, more detailed descriptions
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