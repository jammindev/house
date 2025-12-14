import type { InteractionStatus, ZoneOption } from "@interactions/types";

export interface QuoteFormDefaults {
    status?: InteractionStatus | "";
    occurredAt?: string;
    projectId?: string | null;
    selectedZones?: string[];
}

export type QuoteFormValues = {
    subject: string;
    content: string;
    occurredAt: string;
    projectId: string | null;
    tagIds: string[];
    zoneIds: string[];
    contactIds: string[];
    structureIds: string[];
    amount: string;
};

export type ProjectOption = {
    id: string;
    title: string;
    status: string;
    zoneIds?: string[];
};

export type ZoneOptionWithParent = ZoneOption;
