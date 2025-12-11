import { useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";

import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import type { ZoneOption } from "@interactions/types";
import { buildDefaultZoneSelection } from "../utils/buildDefaultZoneSelection";
import type { NoteFormDefaults, NoteFormValues } from "../types";

interface UseNoteFormStateArgs {
    defaultValues: NoteFormDefaults;
    zones: ZoneOption[];
}

export function useNoteFormState({ defaultValues, zones }: UseNoteFormStateArgs) {
    const initialOccurredAt = useMemo(
        () => defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
        [defaultValues.occurredAt]
    );

    const { defaultZoneSelection, hasDefaultZone, rootZoneId } = useMemo(
        () => buildDefaultZoneSelection(defaultValues.selectedZones, zones),
        [defaultValues.selectedZones, zones]
    );

    const form = useForm<NoteFormValues>({
        defaultValues: {
            subject: "",
            content: "",
            occurredAt: initialOccurredAt,
            projectId: defaultValues.projectId ?? null,
            equipmentId: defaultValues.equipmentId ?? null,
            tagIds: [],
            zoneIds: defaultZoneSelection,
            contactIds: [],
            structureIds: [],
        },
    });

    const subject = useWatch({ control: form.control, name: "subject" }) ?? "";
    const content = useWatch({ control: form.control, name: "content" }) ?? "";
    const occurredAt = useWatch({ control: form.control, name: "occurredAt" }) ?? initialOccurredAt;
    const selectedProjectId = useWatch({ control: form.control, name: "projectId" }) ?? null;
    const selectedEquipmentId = useWatch({ control: form.control, name: "equipmentId" }) ?? null;
    const selectedTagIds = useWatch({ control: form.control, name: "tagIds" }) ?? [];
    const selectedZones = useWatch({ control: form.control, name: "zoneIds" }) ?? [];
    const selectedContactIds = useWatch({ control: form.control, name: "contactIds" }) ?? [];
    const selectedStructureIds = useWatch({ control: form.control, name: "structureIds" }) ?? [];

    const subjectDirty = !!form.formState.dirtyFields.subject;
    const hasZones = zones.length > 0;
    const isSubmitting = form.formState.isSubmitting;

    const resetForm = useCallback(() => {
        form.reset({
            subject: "",
            content: "",
            occurredAt: defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
            projectId: defaultValues.projectId ?? null,
            equipmentId: defaultValues.equipmentId ?? null,
            tagIds: [],
            zoneIds: hasDefaultZone ? defaultValues.selectedZones ?? [] : rootZoneId ? [rootZoneId] : [],
            contactIds: [],
            structureIds: [],
        });
    }, [form, defaultValues, hasDefaultZone, rootZoneId]);

    useEffect(() => {
        if (hasDefaultZone) return;
        if (form.formState.dirtyFields.zoneIds) return;
        if (selectedZones.length > 0) return;
        if (!rootZoneId) return;
        form.setValue("zoneIds", [rootZoneId], { shouldDirty: false });
    }, [form, hasDefaultZone, rootZoneId, selectedZones.length]);

    return {
        form,
        subject,
        content,
        occurredAt,
        selectedProjectId,
        selectedEquipmentId,
        selectedTagIds,
        selectedZones,
        selectedContactIds,
        selectedStructureIds,
        subjectDirty,
        hasZones,
        isSubmitting,
        resetForm,
    };
}
