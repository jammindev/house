export type AIRole = "system" | "user" | "assistant";

export interface AIMessage {
    role: AIRole;
    content: string;
}

export interface ProjectContextOptions {
    interactionsLimit?: number;
    includeEquipment?: boolean;
    includeDocuments?: boolean;
    includeZones?: boolean;
    buildDetailed?: boolean;
}

export interface ProjectContextData {
    project: any;
    household?: any | null;
    interactions?: any[];
    equipment?: any[];
    documents?: any[];
    zones?: any[];
}

export interface ProjectContextResult extends ProjectContextData {
    summary: string;
    detailed?: string;
}
