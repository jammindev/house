import type { InteractionStatus, ZoneOption } from "@interactions/types";

export interface TaskFormDefaults {
    status?: InteractionStatus | "";
    occurredAt?: string;
    projectId?: string | null;
    selectedZones?: string[];
}

export type TaskFormValues = {
    subject: string;
    content: string;
    occurredAt: string;
    status: InteractionStatus | "";
    projectId: string | null;
    tagIds: string[];
    zoneIds: string[];
    contactIds: string[];
    structureIds: string[];
};

export type ProjectOption = {
    id: string;
    title: string;
    status: string;
    zoneIds?: string[];
};

export type ZoneOptionWithParent = ZoneOption;
