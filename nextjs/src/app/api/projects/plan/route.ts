import { NextRequest } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { AI_DEFAULT_MODEL, getOpenAIClient, isAIEnabled } from "@ai";

interface PlanRequestBody {
  title?: string; // Optional - AI will generate if not provided
  description?: string;
  plannedBudget?: number;
  zoneIds: string[];
  tags?: string[];
  startDate?: string;
  dueDate?: string;
  documentContext?: string[]; // URLs or descriptions of uploaded documents
}

interface GeneratedTask {
  subject: string;
  content: string;
  zoneIds: string[];
  priority?: number;
  dueDate?: string;
}

interface GeneratedNote {
  subject: string;
  content: string;
  zoneIds: string[];
}

interface PlanResponse {
  title: string;
  refinedDescription: string;
  todos: GeneratedTask[];
  notes: GeneratedNote[];
}

export async function POST(request: NextRequest) {
  try {
    // Check if AI is enabled
    if (!isAIEnabled()) {
      return Response.json(
        { error: 'AI features are not enabled. Please configure OPENAI_API_KEY.' },
        { status: 503 }
      );
    }

    const body: PlanRequestBody = await request.json();

    // Validate required fields
    if (!body.zoneIds || body.zoneIds.length === 0) {
      return Response.json({ error: 'At least one zone must be selected' }, { status: 400 });
    }

    // Authenticate user
    const supabase = await createSSRClient();
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    
    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get zone names for context
    const { data: zones, error: zonesError } = await supabase
      .from('zones')
      .select('id, name')
      .in('id', body.zoneIds);

    if (zonesError) {
      console.error('Error fetching zones:', zonesError);
      return Response.json({ error: 'Failed to fetch zone information' }, { status: 500 });
    }

    const zoneMap = new Map(zones?.map(z => [z.id, z.name]) || []);
    const zoneNames = body.zoneIds.map(id => zoneMap.get(id) || id).join(', ');

    // Build AI prompt
    const systemPrompt = `You are a household project planning assistant. Your job is to help users structure their renovation, maintenance, repair, or other household projects by:
1. Generating a clear, concise project title (if not provided)
2. Refining the project description to be clear, structured, and actionable
3. Breaking down the project into concrete tasks (todos)
4. Identifying research needs, considerations, and important notes

Return your response as valid JSON matching this schema:
{
  "title": "string (concise project title, max 60 chars)",
  "refinedDescription": "string (enhanced markdown description)",
  "todos": [
    {
      "subject": "string (concise task title)",
      "content": "string (detailed task description with context)",
      "zoneIds": ["zone_id"],
      "priority": number (1-5, optional),
      "dueDate": "YYYY-MM-DD (optional)"
    }
  ],
  "notes": [
    {
      "subject": "string (note title)",
      "content": "string (research items, considerations, warnings)",
      "zoneIds": ["zone_id"]
    }
  ]
}

Guidelines:
- If no title provided, generate one that is descriptive and concise (max 60 characters)
- Keep tasks specific and actionable (e.g., "Contact 3 electricians for quotes" not "Research electricians")
- Include realistic priorities based on dependencies
- Add due dates for time-sensitive tasks
- Notes should capture research needs, safety considerations, permit requirements, etc.
- Reference specific zones when tasks are location-specific
- Consider budget constraints when suggesting tasks
- Be concise but thorough`;

    const userPrompt = `${body.title ? `Project Title: ${body.title}\n` : 'Generate a project title based on the context below.\n'}

${body.description ? `Initial Description:\n${body.description}\n` : ''}
Zones Affected: ${zoneNames}
${body.plannedBudget ? `Budget: $${body.plannedBudget.toLocaleString()}\n` : ''}
${body.tags && body.tags.length > 0 ? `Tags: ${body.tags.join(', ')}\n` : ''}
${body.startDate ? `Start Date: ${body.startDate}\n` : ''}
${body.dueDate ? `Due Date: ${body.dueDate}\n` : ''}
${body.documentContext && body.documentContext.length > 0 ? `\nSupporting Documents:\n${body.documentContext.join('\n')}\n` : ''}

Please analyze this project and generate:
${body.title ? '1. Keep or refine the title\n2' : '1. A concise, descriptive title\n2'}. A refined, well-structured description
${body.title ? '3' : '3'}. A prioritized list of concrete tasks
${body.title ? '4' : '4'}. Important notes and considerations

Ensure all tasks have clear subjects and detailed content. Assign tasks to appropriate zones.`;

    try {
      const openai = getOpenAIClient();
      
      const completion = await openai.chat.completions.create({
        model: AI_DEFAULT_MODEL,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        response_format: { type: 'json_object' },
        temperature: 0.7,
        max_tokens: 2000,
      });

      const response = completion.choices[0]?.message?.content;
      
      if (!response) {
        throw new Error('No response from AI');
      }

      const plan: PlanResponse = JSON.parse(response);

      // Validate response structure
      if (!plan.title || !plan.refinedDescription || !Array.isArray(plan.todos) || !Array.isArray(plan.notes)) {
        throw new Error('Invalid response structure from AI');
      }

      // Ensure all tasks and notes have valid zone IDs
      // Filter to only include zones that were actually provided by the user
      const validZoneIds = new Set(body.zoneIds);
      
      plan.todos.forEach(todo => {
        if (!todo.zoneIds || todo.zoneIds.length === 0) {
          todo.zoneIds = body.zoneIds; // Default to all project zones
        } else {
          // Filter out any invalid zone IDs (AI might return zone names instead of IDs)
          todo.zoneIds = todo.zoneIds.filter(id => validZoneIds.has(id));
          // If no valid zones remain, use all project zones
          if (todo.zoneIds.length === 0) {
            todo.zoneIds = body.zoneIds;
          }
        }
      });

      plan.notes.forEach(note => {
        if (!note.zoneIds || note.zoneIds.length === 0) {
          note.zoneIds = body.zoneIds; // Default to all project zones
        } else {
          // Filter out any invalid zone IDs (AI might return zone names instead of IDs)
          note.zoneIds = note.zoneIds.filter(id => validZoneIds.has(id));
          // If no valid zones remain, use all project zones
          if (note.zoneIds.length === 0) {
            note.zoneIds = body.zoneIds;
          }
        }
      });

      return Response.json(plan);

    } catch (aiError) {
      console.error('OpenAI API error:', aiError);
      
      // Fallback: return structured but minimal plan if AI fails
      const fallbackPlan: PlanResponse = {
        title: body.title || `Project - ${zoneNames}`,
        refinedDescription: body.description || `Project: ${body.title || zoneNames}\n\nZones: ${zoneNames}${body.plannedBudget ? `\nBudget: $${body.plannedBudget.toLocaleString()}` : ''}`,
        todos: [
          {
            subject: 'Plan project scope',
            content: 'Define detailed scope, milestones, and success criteria for this project.',
            zoneIds: body.zoneIds,
            priority: 5,
          },
          {
            subject: 'Research and gather quotes',
            content: 'Contact vendors and gather multiple quotes for comparison.',
            zoneIds: body.zoneIds,
            priority: 4,
          },
        ],
        notes: [
          {
            subject: 'Budget considerations',
            content: `Planned budget: ${body.plannedBudget ? `$${body.plannedBudget.toLocaleString()}` : 'not specified'}. Track expenses as they occur.`,
            zoneIds: body.zoneIds,
          },
        ],
      };

      return Response.json(fallbackPlan);
    }

  } catch (error) {
    console.error('Error in /api/projects/plan:', error);
    return Response.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
