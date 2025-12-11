import type { InteractionStatus, ZoneOption } from "@interactions/types";

export interface NoteFormDefaults {
    status?: InteractionStatus | "";
    occurredAt?: string;
    projectId?: string | null;
    equipmentId?: string | null;
    selectedZones?: string[];
}

export type NoteFormValues = {
    subject: string;
    content: string;
    occurredAt: string;
    projectId: string | null;
    equipmentId: string | null;
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

export type EquipmentOption = {
    id: string;
    name: string;
    status: string | null;
    zoneId?: string | null;
};
