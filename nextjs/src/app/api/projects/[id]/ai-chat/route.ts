import { NextRequest } from "next/server";
import OpenAI from "openai";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

interface ChatRequestBody {
  threadId?: string;
  message: string;
}

// Helper function to redact PII
function redactPII(text: string): string {
  // Redact email patterns
  const emailRedacted = text.replace(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g, '[EMAIL_REDACTED]');
  
  // Redact phone patterns (basic)
  const phoneRedacted = emailRedacted.replace(/\b(?:\+?1[-.\s]?)?\(?[0-9]{3}\)?[-.\s]?[0-9]{3}[-.\s]?[0-9]{4}\b/g, '[PHONE_REDACTED]');
  
  return phoneRedacted;
}

// Helper function to summarize project context to stay under token limits
function summarizeProjectContext(project: any, interactions: any[]): string {
  const projectSummary = `Project: ${project.title}
Description: ${project.description || 'No description provided'}
Status: ${project.status}
Priority: ${project.priority}/5
Start Date: ${project.start_date || 'Not set'}
Due Date: ${project.due_date || 'Not set'}
Planned Budget: €${project.planned_budget || 0}
Actual Cost: €${project.actual_cost_cached || 0}
Tags: ${project.tags?.join(', ') || 'None'}`;

  const interactionsSummary = interactions.length > 0 
    ? `\n\nRecent Project Activity (${interactions.length} items):\n` + 
      interactions.slice(0, 25).map((interaction, i) => 
        `${i + 1}. [${interaction.type}] ${interaction.subject} (${interaction.occurred_at?.split('T')[0] || 'No date'}) - Status: ${interaction.status || 'N/A'}`
      ).join('\n')
    : '\n\nNo recent activity recorded.';

  return redactPII(projectSummary + interactionsSummary);
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const resolvedParams = await params;
    console.log('AI Chat API: Starting request for project:', resolvedParams.id);
    
    const projectId = resolvedParams.id;
    const body: ChatRequestBody = await request.json();
    
    console.log('AI Chat API: Request body received:', { hasMessage: !!body.message, threadId: body.threadId });
    
    if (!body.message?.trim()) {
      return Response.json({ error: 'Message is required' }, { status: 400 });
    }

    console.log('AI Chat API: Creating Supabase clients');
    const supabase = await createSSRClient();
    const adminClient = await createServerAdminClient();
    
    // Get current user
    console.log('AI Chat API: Getting current user');
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      console.error('AI Chat API: User authentication failed:', userError);
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    console.log('AI Chat API: User authenticated:', user.id);

    // Verify project access through household membership
    console.log('AI Chat API: Verifying project access');
    const { data: project, error: projectError } = await supabase
      .from('projects')
      .select(`
        *,
        households!inner(
          household_members!inner(user_id)
        )
      `)
      .eq('id', projectId)
      .eq('households.household_members.user_id', user.id)
      .single();

    if (projectError || !project) {
      console.error('AI Chat API: Project access denied:', projectError);
      return Response.json({ error: 'Project not found or access denied' }, { status: 404 });
    }
    
    console.log('AI Chat API: Project access verified:', project.id);

    let threadId = body.threadId;
    let messages: any[] = [];

    // If no threadId provided, create a new thread
    if (!threadId) {
      console.log('AI Chat API: Creating new thread');
      const { data, error } = await (adminClient as any)
        .from('project_ai_threads')
        .insert({
          project_id: projectId,
          household_id: project.household_id,
          user_id: user.id,
          title: body.message.slice(0, 50) + (body.message.length > 50 ? '...' : ''),
        })
        .select()
        .single();

      if (error) {
        console.error('AI Chat API: Failed to create thread:', error);
        return Response.json({ error: 'Failed to create thread' }, { status: 500 });
      }
      threadId = data.id;
      console.log('AI Chat API: Thread created:', threadId);
    } else {
      console.log('AI Chat API: Using existing thread:', threadId);
      // Verify thread access
      const { data: threadCheck } = await (adminClient as any)
        .from('project_ai_threads')
        .select('id')
        .eq('id', threadId)
        .eq('user_id', user.id)
        .single();

      if (!threadCheck) {
        return Response.json({ error: 'Thread not found or access denied' }, { status: 404 });
      }

      // Get existing messages
      const { data: existingMessages } = await (adminClient as any)
        .from('project_ai_messages')
        .select('role, content')
        .eq('thread_id', threadId)
        .order('created_at', { ascending: true });

      if (existingMessages) {
        messages = existingMessages;
      }
    }

    // Store user message
    console.log('AI Chat API: Storing user message');
    const { error: userMessageError } = await (adminClient as any)
      .from('project_ai_messages')
      .insert({
        thread_id: threadId,
        role: 'user',
        content: body.message,
      });

    if (userMessageError) {
      console.error('AI Chat API: Failed to store message:', userMessageError);
      return Response.json({ error: 'Failed to store message' }, { status: 500 });
    }

    // Verify OpenAI API key is configured
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
      console.error('AI Chat API: OpenAI API key not configured');
      return Response.json({ error: 'AI service not configured' }, { status: 503 });
    }

    // Gather project context for real OpenAI response
    console.log('AI Chat API: Gathering project context');
    const { data: interactions, error: interactionsError } = await supabase
      .from('interactions')
      .select(`
        subject,
        content,
        type,
        status,
        occurred_at,
        tags,
        metadata,
        interaction_zones!inner(
          zones(name)
        )
      `)
      .eq('project_id', projectId)
      .order('occurred_at', { ascending: false })
      .limit(25);

    const contextSummary = summarizeProjectContext(project, interactions || []);

    // Build conversation for OpenAI
    const conversationMessages = [
      {
        role: "system" as const,
        content: `You are a helpful AI assistant for the "House" household management application. You help users understand and manage their home projects.

Current Project Context:
${contextSummary}

Guidelines:
- Provide helpful, actionable advice about this project
- Reference the project's current status, budget, and timeline when relevant
- If asked about specific interactions or activities, refer to the recent activity list
- Keep responses concise but informative
- If you don't have enough information, suggest what data might be helpful to track
- Do not edit or modify any project data - you can only provide advice and insights
- Focus on practical household management advice`
      },
      ...messages.map(msg => ({
        role: msg.role as "user" | "assistant",
        content: msg.content
      })),
      {
        role: "user" as const,
        content: body.message
      }
    ];

    // Get OpenAI response
    console.log('AI Chat API: Getting OpenAI response');
    let completion;
    try {
      completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: conversationMessages,
        temperature: 0.2,
        stream: true,
      });
    } catch (openaiError: any) {
      console.error('OpenAI API Error:', openaiError);
      
      // Handle specific OpenAI errors
      if (openaiError.status === 429) {
        console.log('AI Chat API: OpenAI quota exceeded');
        return Response.json({ error: 'AI service quota exceeded. Please try again later.' }, { status: 429 });
      }
      
      if (openaiError.status === 401) {
        console.error('AI Chat API: OpenAI API key invalid');
        return Response.json({ error: 'AI service authentication failed' }, { status: 503 });
      }
      
      throw openaiError; // Re-throw other errors
    }

    // Create a ReadableStream to stream the response
    const stream = new ReadableStream({
      async start(controller) {
        let fullResponse = '';
        
        try {
          for await (const chunk of completion) {
            const content = chunk.choices[0]?.delta?.content;
            if (content) {
              fullResponse += content;
              // Send chunk to client
              controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ content })}\n\n`));
            }
          }

          // Store assistant response in database
          if (fullResponse.trim()) {
            await (adminClient as any)
              .from('project_ai_messages')
              .insert({
                thread_id: threadId,
                role: 'assistant',
                content: fullResponse,
              });
          }

          // Send final event
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ done: true, threadId })}\n\n`));
        } catch (error) {
          console.error('OpenAI streaming error:', error);
          controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify({ error: 'Failed to get AI response' })}\n\n`));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error) {
    console.error('AI chat error:', error);
    console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}