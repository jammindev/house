import { redactPII } from "./lib/redact";
import type { AIMessage } from "./types";

export const AI_PROMPT_DEFINITIONS = {
    interactionImprove: "Refines interaction content into clean HTML while keeping the user's language and intent.",
    projectChat: "Conversational helper that answers questions about a project using recent activity and household context.",
    projectDescriptionGenerate: "Creates a narrative project description (markdown) from the detailed context.",
    projectDescriptionUpdate: "Rewrites an existing project description using fresh context and tone guidance.",
};

interface InteractionPromptArgs {
    content: string;
    userPrompt: string;
    projectContext?: string;
}

export function buildInteractionImprovementMessages({
    content,
    userPrompt,
    projectContext,
}: InteractionPromptArgs): AIMessage[] {
    const safeContent = redactPII(content || "No content provided yet.");
    const safePrompt = redactPII(userPrompt);

    return [
        {
            role: "system",
            content: `You are an AI assistant for the "House" application, helping users write and refine interaction notes and project updates.
${projectContext ? `\nProject context:\n${projectContext}\n` : ""}
Guidelines:
- Return clean HTML only (no markdown, no <html> wrapper, no inline styles).
- Use simple tags like <p>, <ul>, <ol>, <li>, <strong>, <em>, <h3>.
- Keep the user's intent and existing details; improve clarity, structure, and actionable next steps when appropriate.
- Do not invent data; if information is missing, keep the content neutral.
- Keep the language consistent with the user's input language.
- Avoid scripts, forms, embedded media, or external links.`,
        },
        {
            role: "user",
            content: `Current interaction content:
${safeContent}`,
        },
        {
            role: "user",
            content: `User request for refinement:
${safePrompt}`,
        },
    ];
}

interface ProjectChatPromptArgs {
    contextSummary: string;
    history?: AIMessage[];
    userMessage: string;
}

export function buildProjectChatMessages({
    contextSummary,
    history = [],
    userMessage,
}: ProjectChatPromptArgs): AIMessage[] {
    const systemMessage: AIMessage = {
        role: "system",
        content: `You are a helpful AI assistant for the "House" household management application. You help users understand and manage their home projects.

Current Project Context:
${contextSummary}

OUTPUT FORMAT: Always format your responses using clean markdown for better readability:
- **Bold text** for emphasis and important points
- ## Headings for main sections (use ## for sections, ### for subsections)
- - Bullet points for lists and action items
- Plain text for paragraphs
- NO code blocks, tables, or complex formatting

Guidelines:
- Provide helpful, actionable advice about this project
- Reference the project's current status, budget, and timeline when relevant
- If asked about specific interactions or activities, refer to the recent activity list
- Keep responses concise but informative
- Use markdown formatting for better structure and readability
- If you don't have enough information, suggest what data might be helpful to track
- Do not edit or modify any project data - you can only provide advice and insights
- Focus on practical household management advice

FORMATTING EXAMPLE:
## Analysis
[Your analysis here...]

**Key Recommendations:**
- First recommendation
- Second recommendation

## Next Steps
[Actionable steps...]`,
    };

    return [
        systemMessage,
        ...history,
        {
            role: "user",
            content: userMessage,
        },
    ];
}

interface ProjectDescriptionPromptArgs {
    action: "generate" | "update";
    context: string;
    locale: "fr" | "en";
    additionalInstructions?: string;
    existingDescription?: string | null;
}

export function buildProjectDescriptionMessages({
    action,
    context,
    locale,
    additionalInstructions,
    existingDescription,
}: ProjectDescriptionPromptArgs): AIMessage[] {
    const languageInstruction = locale === "fr" ? "Écrivez en français." : "Write in English.";
    const extraInstructions = additionalInstructions ? `\n\nADDITIONAL INSTRUCTIONS FROM USER:\n${redactPII(additionalInstructions)}` : "";
    const currentDescriptionContext = action === "update" && existingDescription
        ? `\n\nCURRENT DESCRIPTION TO IMPROVE:\n"${redactPII(existingDescription)}"`
        : "";

    const systemContent = action === "generate"
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
${context}${currentDescriptionContext}${extraInstructions}`
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
${context}${currentDescriptionContext}${extraInstructions}`;

    return [
        {
            role: "system",
            content: systemContent,
        },
        {
            role: "user",
            content: `Please ${action === "generate" ? "generate" : "update"} a project description based on the provided information.`,
        },
    ];
}
