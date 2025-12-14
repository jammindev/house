import { useCallback, useEffect, useMemo } from "react";
import { useForm, useWatch } from "react-hook-form";

import { getCurrentLocalDateTimeInput } from "@interactions/utils/datetime";
import type { ZoneOption } from "@interactions/types";
import { buildDefaultZoneSelection } from "../utils/buildDefaultZoneSelection";
import type { QuoteFormDefaults, QuoteFormValues } from "../types";

interface UseQuoteFormStateArgs {
    defaultValues: QuoteFormDefaults;
    zones: ZoneOption[];
}

export function useQuoteFormState({ defaultValues, zones }: UseQuoteFormStateArgs) {
    const initialOccurredAt = useMemo(
        () => defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
        [defaultValues.occurredAt]
    );

    const { defaultZoneSelection, hasDefaultZone, rootZoneId } = useMemo(
        () => buildDefaultZoneSelection(defaultValues.selectedZones, zones),
        [defaultValues.selectedZones, zones]
    );

    const form = useForm<QuoteFormValues>({
        defaultValues: {
            subject: "",
            content: "",
            occurredAt: initialOccurredAt,
            projectId: defaultValues.projectId ?? null,
            tagIds: [],
            zoneIds: defaultZoneSelection,
            contactIds: [],
            structureIds: [],
            amount: "",
        },
    });

    const subject = useWatch({ control: form.control, name: "subject" }) ?? "";
    const content = useWatch({ control: form.control, name: "content" }) ?? "";
    const occurredAt = useWatch({ control: form.control, name: "occurredAt" }) ?? initialOccurredAt;
    const selectedProjectId = useWatch({ control: form.control, name: "projectId" }) ?? null;
    const selectedTagIds = useWatch({ control: form.control, name: "tagIds" }) ?? [];
    const selectedZones = useWatch({ control: form.control, name: "zoneIds" }) ?? [];
    const selectedContactIds = useWatch({ control: form.control, name: "contactIds" }) ?? [];
    const selectedStructureIds = useWatch({ control: form.control, name: "structureIds" }) ?? [];
    const amount = useWatch({ control: form.control, name: "amount" }) ?? "";

    const subjectDirty = !!form.formState.dirtyFields.subject;
    const hasZones = zones.length > 0;
    const isSubmitting = form.formState.isSubmitting;

    const resetForm = useCallback(() => {
        form.reset({
            subject: "",
            content: "",
            occurredAt: defaultValues.occurredAt ?? getCurrentLocalDateTimeInput(),
            projectId: defaultValues.projectId ?? null,
            tagIds: [],
            zoneIds: hasDefaultZone ? defaultValues.selectedZones ?? [] : rootZoneId ? [rootZoneId] : [],
            contactIds: [],
            structureIds: [],
            amount: "",
        });
    }, [defaultValues.occurredAt, defaultValues.projectId, defaultValues.selectedZones, form, hasDefaultZone, rootZoneId]);

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
        selectedTagIds,
        selectedZones,
        selectedContactIds,
        selectedStructureIds,
        subjectDirty,
        hasZones,
        isSubmitting,
        amount,
        resetForm,
    };
}
