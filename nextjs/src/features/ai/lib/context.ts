import { redactPII } from "./redact";
import type { ProjectContextData, ProjectContextOptions, ProjectContextResult } from "../types";

interface GetProjectContextArgs {
    supabase: any;
    projectId?: string;
    project?: any;
    options?: ProjectContextOptions;
}

export async function getProjectContext({
    supabase,
    projectId,
    project,
    options = {},
}: GetProjectContextArgs): Promise<ProjectContextResult | null> {
    const interactionsLimit = options.interactionsLimit ?? 25;
    const includeEquipment = options.includeEquipment ?? false;
    const includeDocuments = options.includeDocuments ?? false;
    const includeZones = options.includeZones ?? false;
    const buildDetailed = options.buildDetailed ?? false;

    let resolvedProject = project;

    if (!resolvedProject && projectId) {
        const { data, error } = await supabase
            .from("projects")
            .select("id, title, description, status, priority, start_date, due_date, planned_budget, actual_cost_cached, tags, household_id, type, created_at, updated_at")
            .eq("id", projectId)
            .single();

        if (error || !data) {
            console.warn("getProjectContext: failed to load project", error);
            return null;
        }

        resolvedProject = data;
    }

    if (!resolvedProject) {
        console.warn("getProjectContext: no project provided");
        return null;
    }

    const householdPromise = supabase
        .from("households")
        .select("name, address, city, country, context_notes, ai_prompt_context")
        .eq("id", resolvedProject.household_id)
        .single();

    const interactionsPromise = supabase
        .from("interactions")
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
        .eq("project_id", resolvedProject.id)
        .order("occurred_at", { ascending: false })
        .limit(interactionsLimit);

    const zonesPromise = includeZones
        ? supabase
            .from("zones")
            .select("id, name, note, surface")
            .eq("household_id", resolvedProject.household_id)
        : null;

    const [householdResult, interactionsResult, zonesResult] = await Promise.all([
        householdPromise,
        interactionsPromise,
        zonesPromise,
    ]);

    const household = !householdResult?.error ? householdResult?.data : null;
    const interactions = !interactionsResult?.error && Array.isArray(interactionsResult?.data)
        ? interactionsResult?.data
        : [];
    const zones = includeZones && zonesResult && !zonesResult.error && Array.isArray(zonesResult.data)
        ? zonesResult.data
        : [];

    const projectZoneIds = interactions
        .flatMap((interaction: any) => interaction.interaction_zones?.map((iz: any) => iz.zones?.id))
        .filter(Boolean);

    let equipment: any[] = [];
    if (includeEquipment && projectZoneIds.length > 0) {
        const { data, error } = await supabase
            .from("equipment")
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
            .eq("household_id", resolvedProject.household_id)
            .in("zone_id", projectZoneIds);

        if (!error && Array.isArray(data)) {
            equipment = data;
        } else if (error) {
            console.warn("getProjectContext: failed to load equipment", error);
        }
    }

    let documents: any[] = [];
    if (includeDocuments) {
        const { data, error } = await supabase
            .from("documents")
            .select(`
                id,
                name,
                type,
                mime_type,
                notes,
                created_at,
                interactions!inner(id, subject, project_id)
            `)
            .eq("interactions.project_id", resolvedProject.id);

        if (!error && Array.isArray(data)) {
            documents = data;
        } else if (error) {
            console.warn("getProjectContext: failed to load documents", error);
        }
    }

    const contextData: ProjectContextData = {
        project: resolvedProject,
        household,
        interactions,
        equipment,
        documents,
        zones,
    };

    const summary = buildProjectSummary(contextData, interactionsLimit);
    const detailed = buildDetailed ? buildProjectDetails(contextData) : undefined;

    return {
        ...contextData,
        summary,
        detailed,
    };
}

function buildProjectSummary(context: ProjectContextData, interactionsLimit = 25): string {
    const { project, household, interactions = [] } = context;

    const householdSummary = household
        ? `Household: ${household.name}
${household.address ? `Address: ${household.address}` : ""}
${household.city ? `Location: ${household.city}${household.country ? `, ${household.country}` : ""}` : ""}
${household.context_notes ? `Context: ${household.context_notes}` : ""}
${household.ai_prompt_context ? `AI Context: ${household.ai_prompt_context}` : ""}

`
        : "";

    const projectSummary = `Project: ${project.title}
Description: ${project.description || "No description provided"}
Status: ${project.status}
Priority: ${project.priority}/5
Start Date: ${project.start_date || "Not set"}
Due Date: ${project.due_date || "Not set"}
Planned Budget: €${project.planned_budget || 0}
Actual Cost: €${project.actual_cost_cached || 0}
Tags: ${project.tags?.join(", ") || "None"}`;

    const interactionsSummary = interactions.length > 0
        ? `\n\nRecent Project Activity (${Math.min(interactions.length, interactionsLimit)} items):\n` +
        interactions.slice(0, interactionsLimit).map((interaction: any, i: number) =>
            `${i + 1}. [${interaction.type}] ${interaction.subject} (${interaction.occurred_at?.split("T")[0] || "No date"}) - Status: ${interaction.status || "N/A"}`
        ).join("\n")
        : "\n\nNo recent activity recorded.";

    return redactPII(householdSummary + projectSummary + interactionsSummary);
}

function buildProjectDetails(context: ProjectContextData): string {
    const { project, household, zones = [], interactions = [], equipment = [], documents = [] } = context;

    const householdInfo = household ? `
HOUSEHOLD CONTEXT:
- Name: ${household.name}
${household.address ? `- Address: ${household.address}` : ""}
${household.city ? `- City: ${household.city}${household.country ? `, ${household.country}` : ""}` : ""}
${household.country && !household.city ? `- Country: ${household.country}` : ""}
${household.context_notes ? `- General Context: ${household.context_notes}` : ""}
${household.ai_prompt_context ? `- AI Context: ${household.ai_prompt_context}` : ""}
` : "";

    const projectInfo = `
PROJECT DETAILS:
- Title: ${project.title}
- Type: ${project.type || "Not specified"}
- Status: ${project.status}
- Priority: ${project.priority}/5
- Start Date: ${project.start_date || "Not set"}
- Due Date: ${project.due_date || "Not set"}
- Planned Budget: €${project.planned_budget || 0}
- Actual Cost: €${project.actual_cost_cached || 0}
- Group: ${project.group?.name || project.project_groups?.name || "No group"}
- Tags: ${project.tags?.join(", ") || "None"}
- Current Description: ${project.description || "None"}
- Created: ${project.created_at}
- Last Updated: ${project.updated_at}
`;

    const zonesInfo = zones.length > 0
        ? `
ZONES INVOLVED:
${zones.map((zone: any, i: number) =>
            `${i + 1}. ${zone.name}${zone.surface ? ` (${zone.surface}m²)` : ""}${zone.note ? ` - ${zone.note}` : ""}`
        ).join("\n")}`
        : "\nZONES INVOLVED: None specified";

    const interactionsByType = interactions.reduce((acc: any, interaction: any) => {
        if (!acc[interaction.type]) acc[interaction.type] = [];
        acc[interaction.type].push(interaction);
        return acc;
    }, {}) as Record<string, any[]>;

    const interactionsInfo = Object.keys(interactionsByType).length > 0
        ? `
PROJECT ACTIVITIES:
${Object.entries(interactionsByType).map(([type, items]: [string, any]) =>
            `
${type.toUpperCase()} (${items.length} items):
${items.slice(0, 10).map((item: any, i: number) =>
                `  ${i + 1}. ${item.subject} - Status: ${item.status || "N/A"} (${item.occurred_at?.split("T")[0] || "No date"})
     ${item.content ? `     Details: ${item.content.substring(0, 150)}${item.content.length > 150 ? "..." : ""}` : ""}
     ${item.tags?.length ? `     Tags: ${item.tags.join(", ")}` : ""}
     ${item.interaction_zones?.length ? `     Zones: ${item.interaction_zones.map((iz: any) => iz.zones?.name).join(", ")}` : ""}`
            ).join("\n")}`
        ).join("\n")}`
        : "\nPROJECT ACTIVITIES: No activities recorded";

    const equipmentInfo = equipment.length > 0
        ? `
RELATED EQUIPMENT:
${equipment.map((eq: any, i: number) =>
            `${i + 1}. ${eq.name} (${eq.category})${eq.manufacturer ? ` by ${eq.manufacturer}` : ""}
   Status: ${eq.status} | Condition: ${eq.condition || "Not specified"}
   Zone: ${eq.zones?.name || "Unassigned"}
   ${eq.warranty_expires_on ? `Warranty expires: ${eq.warranty_expires_on}` : ""}
   ${eq.next_service_due ? `Next service: ${eq.next_service_due}` : ""}
   ${eq.notes ? `Notes: ${eq.notes}` : ""}`
        ).join("\n")}`
        : "\nRELATED EQUIPMENT: None found";

    const documentsInfo = documents.length > 0
        ? `
PROJECT DOCUMENTS:
${documents.map((doc: any, i: number) =>
            `${i + 1}. ${doc.name} (${doc.type}) - ${doc.mime_type}
   ${doc.notes ? `Notes: ${doc.notes}` : ""}
   Created: ${doc.created_at?.split("T")[0]}`
        ).join("\n")}`
        : "\nPROJECT DOCUMENTS: None attached";

    return redactPII(householdInfo + projectInfo + zonesInfo + interactionsInfo + equipmentInfo + documentsInfo);
}
