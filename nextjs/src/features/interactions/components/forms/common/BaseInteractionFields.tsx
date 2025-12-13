// nextjs/src/features/interactions/components/forms/common/BaseInteractionFields.tsx
"use client";

import { useMemo } from "react";
import { Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { TinyEditor } from "@/components/rich-text/TinyEditor";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { ZonePicker } from "@interactions/components/ZonePicker";
import InteractionTagsSelector from "@interactions/components/InteractionTagsSelector";
import type { InteractionStatus, ZoneOption } from "@interactions/types";
import { INTERACTION_STATUSES } from "@interactions/constants";

export interface BaseInteractionFieldsProps {
    currentStep?: number;

    // Subject fields
    subject: string;
    onSubjectChange: (value: string) => void;
    subjectDirty: boolean;
    onSubjectDirtyChange: (dirty: boolean) => void;
    isAutoSubjectType?: boolean;
    subjectPlaceholder?: string;

    // Status field
    status?: InteractionStatus | "";
    onStatusChange?: (status: InteractionStatus | "") => void;

    // Date field
    occurredAt: string;
    onOccurredAtChange: (date: string) => void;
    showOccurredAt?: boolean;

    // Project field
    selectedProjectId: string | null;
    onProjectChange: (projectId: string | null) => void;
    projectOptions: Array<{ id: string; title: string; status: string }>;
    projectLoading: boolean;
    projectError: string;
    showProject?: boolean;
    projectReadonly?: boolean;
    selectedEquipmentId?: string | null;
    onEquipmentChange?: (equipmentId: string | null) => void;
    equipmentOptions?: Array<{ id: string; name: string; status: string | null }>;
    equipmentLoading?: boolean;
    equipmentError?: string;

    // Tags field
    selectedTagIds: string[];
    onTagsChange: (tagIds: string[]) => void;
    showTags?: boolean;

    // Zones fields
    selectedZones: string[];
    onZonesChange: React.Dispatch<React.SetStateAction<string[]>>;
    zones: ZoneOption[];
    zonesLoading: boolean;
    hasZones: boolean;
    zonesLocked?: { locked: boolean; zoneNames?: string[]; helper?: string };

    // Content field
    content: string;
    onContentChange: (content: string) => void;

    // Household ID
    householdId: string | null;
}

export default function BaseInteractionFields({
    subject,
    onSubjectChange,
    onSubjectDirtyChange,
    isAutoSubjectType = false,
    subjectPlaceholder,
    status,
    onStatusChange,
    occurredAt,
    onOccurredAtChange,
    showOccurredAt = true,
    selectedProjectId,
    onProjectChange,
    projectOptions,
    projectLoading,
    projectError,
    showProject = true,
    projectReadonly = false,
    selectedEquipmentId,
    onEquipmentChange,
    equipmentOptions = [],
    equipmentLoading = false,
    equipmentError = "",
    selectedTagIds,
    onTagsChange,
    showTags = true,
    selectedZones,
    onZonesChange,
    zones,
    zonesLoading,
    hasZones,
    zonesLocked,
    content,
    onContentChange,
    householdId,
    currentStep,
}: BaseInteractionFieldsProps) {
    const { t } = useI18n();
    const isStepMode = typeof currentStep === "number";
    const showBasicsStep = !isStepMode || currentStep === 0;
    const showDetailsStep = !isStepMode || currentStep === 1;

    const zoneHelper = useMemo(() => {
        if (zonesLoading) return t("zones.loading");
        if (!hasZones) return t("zones.none");
        return t("interactionszoneHelper");
    }, [hasZones, t, zonesLoading]);

    const hasDetailContent = (status !== undefined && !!onStatusChange) || showOccurredAt || showTags;
    const displayDetailCard = showDetailsStep && hasDetailContent;

    return (
        <>
            {showBasicsStep ? (
                <>
                    <div className="space-y-2">
                        <label className="font-medium text-gray-700" htmlFor="interaction-subject">
                            {t("common.subject")}
                        </label>
                        <Input
                            id="interaction-subject"
                            value={subject}
                            onChange={(event) => {
                                const nextValue = event.target.value;
                                onSubjectChange(nextValue);
                                onSubjectDirtyChange(nextValue.trim().length > 0);
                            }}
                            placeholder={subjectPlaceholder || t("interactionssubjectPlaceholder")}
                            aria-describedby={isAutoSubjectType ? "interaction-subject-auto" : undefined}
                        />
                        {isAutoSubjectType && (
                            <p id="interaction-subject-auto" className="flex items-center gap-2 text-xs text-gray-500">
                                <Info className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                                {t("interactionsautoSubjectNotice")}
                            </p>
                        )}
                    </div>

                    <TinyEditor
                        id="interaction-description"
                        value={content}
                        onChange={onContentChange}
                        textareaName="interaction-description"
                    />
                </>
            ) : null}

            {showDetailsStep ? (
                <>
                    {displayDetailCard && (
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-base font-semibold">{t("interactionssections.details")}</CardTitle>
                                <CardDescription>{t("interactionssubjectHelper")}</CardDescription>
                            </CardHeader>
                            <CardContent className="space-y-6">
                                <div className="grid gap-4 md:grid-cols-2">
                                    {/* Status field - only show if status props are provided */}
                                    {status !== undefined && onStatusChange && (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-status">
                                                {t("interactionsstatusLabel")}
                                            </label>
                                            <select
                                                id="interaction-status"
                                                value={status}
                                                onChange={(event) => onStatusChange(event.target.value as InteractionStatus | "")}
                                                className="border rounded-md h-9 w-full px-3 text-sm bg-background"
                                            >
                                                {INTERACTION_STATUSES.map((value) => (
                                                    <option key={value ?? "none"} value={value ?? ""}>
                                                        {value ? t(`interactionsstatus.${value}`) : t("interactionsstatusNone")}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    )}

                                    {showOccurredAt ? (
                                        <div className="space-y-2">
                                            <label className="text-sm font-medium text-gray-700" htmlFor="interaction-occurred-at">
                                                {t("interactionsoccurredAtLabel")}
                                            </label>
                                            <Input
                                                id="interaction-occurred-at"
                                                type="datetime-local"
                                                value={occurredAt}
                                                onChange={(event) => onOccurredAtChange(event.target.value)}
                                            />
                                        </div>
                                    ) : null}
                                </div>

                                {showTags ? (
                                    <InteractionTagsSelector
                                        householdId={householdId}
                                        value={selectedTagIds}
                                        onChange={onTagsChange}
                                        inputId="interaction-tags"
                                    />
                                ) : null}
                            </CardContent>
                        </Card>
                    )}

                    {/* Project Card */}
                    {showProject && (
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-base font-semibold">{t("interactionsprojectLabel")}</CardTitle>
                                <CardDescription>{t("interactionsprojectHelper")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <select
                                        id="interaction-project"
                                        value={selectedProjectId ?? ""}
                                        onChange={(event) => onProjectChange(event.target.value ? event.target.value : null)}
                                        disabled={projectLoading || projectReadonly}
                                        className="border rounded-md h-9 w-full px-3 text-sm bg-background disabled:opacity-60"
                                    >
                                        <option value="">{t("interactionsprojectNone")}</option>
                                        {projectOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.title} · {t(`projects.status.${option.status}`)}
                                            </option>
                                        ))}
                                    </select>
                                    {projectReadonly && (
                                        <p className="text-xs text-blue-600">
                                            {t("interactionsprojectReadonlyHelper")}
                                        </p>
                                    )}
                                    {projectError && (
                                        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                                            {projectError}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    {/* Equipment Card */}
                    {onEquipmentChange && (
                        <Card>
                            <CardHeader className="space-y-1">
                                <CardTitle className="text-base font-semibold">{t("forms.note.equipmentLabel")}</CardTitle>
                                <CardDescription>{t("forms.note.equipmentHelper")}</CardDescription>
                            </CardHeader>
                            <CardContent>
                                <div className="space-y-2">
                                    <select
                                        id="interaction-equipment"
                                        value={selectedEquipmentId ?? ""}
                                        onChange={(event) => onEquipmentChange(event.target.value ? event.target.value : null)}
                                        disabled={equipmentLoading}
                                        className="border rounded-md h-9 w-full px-3 text-sm bg-background disabled:opacity-60"
                                    >
                                        <option value="">{t("forms.note.equipmentPlaceholder")}</option>
                                        {equipmentOptions.map((option) => (
                                            <option key={option.id} value={option.id}>
                                                {option.name}
                                                {option.status ? ` · ${option.status}` : ""}
                                            </option>
                                        ))}
                                    </select>
                                    {equipmentError && (
                                        <div className="rounded-md border border-rose-200 bg-rose-50 p-2 text-xs text-rose-700">
                                            {equipmentError}
                                        </div>
                                    )}
                                </div>
                            </CardContent>
                        </Card>
                    )}

                    <Card>
                        <CardHeader className="space-y-1">
                            <CardTitle className="text-lg font-semibold">{t("interactionssections.zones")}</CardTitle>
                            <CardDescription>{zoneHelper}</CardDescription>
                        </CardHeader>
                        <CardContent>
                            {zonesLocked?.locked ? (
                                <div className="rounded-md border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                                    <p>{zonesLocked.helper || t("forms.note.projectZonesLocked")}</p>
                                    {zonesLocked.zoneNames?.length ? (
                                        <ul className="mt-2 list-disc pl-4 text-slate-800">
                                            {zonesLocked.zoneNames.map((name) => (
                                                <li key={name}>{name}</li>
                                            ))}
                                        </ul>
                                    ) : null}
                                </div>
                            ) : zonesLoading ? (
                                <div className="text-sm text-gray-500">{t("common.loading")}</div>
                            ) : hasZones ? (
                                <ZonePicker zones={zones} value={selectedZones} onChange={onZonesChange} />
                            ) : (
                                <div className="text-sm text-gray-500">{t("zones.none")}</div>
                            )}
                        </CardContent>
                    </Card>
                </>
            ) : null}
        </>
    );
}
