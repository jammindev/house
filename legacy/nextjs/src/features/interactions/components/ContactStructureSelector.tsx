"use client";

import { useEffect } from "react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { useI18n } from "@/lib/i18n/I18nProvider";
import { useContacts } from "@contacts/hooks/useContacts";
import { useStructures } from "@structures/hooks/useStructures";
import ContactSelector from "./ContactSelector";
import StructureSelector from "./StructureSelector";

interface ContactStructureSelectorProps {
    householdId: string;
    selectedContactIds: string[];
    onContactsChange: (contactIds: string[]) => void;
    selectedStructureIds: string[];
    onStructuresChange: (structureIds: string[]) => void;
    contactsLabel?: string;
    contactsHelper?: string;
    structuresLabel?: string;
    structuresHelper?: string;
    title?: string;
    description?: string;
    autoFillStructure?: boolean;
}

export default function ContactStructureSelector({
    householdId,
    selectedContactIds,
    onContactsChange,
    selectedStructureIds,
    onStructuresChange,
    contactsLabel,
    contactsHelper,
    structuresLabel,
    structuresHelper,
    title,
    description,
    autoFillStructure = true,
}: ContactStructureSelectorProps) {
    const { t } = useI18n();
    const { contacts } = useContacts();
    const { structures } = useStructures();

    // Auto-fill structure when a contact with a structure is selected
    useEffect(() => {
        if (!autoFillStructure || selectedContactIds.length === 0) return;

        // Get all structures from selected contacts
        const contactStructureIds = selectedContactIds
            .map((contactId) => {
                const contact = contacts.find((c) => c.id === contactId);
                return contact?.structure_id;
            })
            .filter((structureId): structureId is string => !!structureId);

        if (contactStructureIds.length === 0) return;

        // Only add new structure IDs that aren't already selected
        const newStructureIds = contactStructureIds.filter(
            (structureId) => !selectedStructureIds.includes(structureId)
        );

        if (newStructureIds.length > 0) {
            onStructuresChange([...selectedStructureIds, ...newStructureIds]);
        }
    }, [
        selectedContactIds,
        contacts,
        selectedStructureIds,
        onStructuresChange,
        autoFillStructure,
    ]);

    const defaultContactsLabel = t("interactionscontacts.label");
    const defaultContactsHelper = t("forms.quote.contactsHelper");
    const defaultStructuresLabel = t("interactionsstructures.label");
    const defaultStructuresHelper = t("forms.quote.structuresHelper");

    return (
        <Card>
            <CardHeader className="space-y-1">
                {(title || description) && (
                    <>
                        {title && <CardTitle className="text-lg font-semibold">{title}</CardTitle>}
                        {description && <CardDescription>{description}</CardDescription>}
                    </>
                )}
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        {contactsLabel || defaultContactsLabel}
                    </label>
                    {(contactsHelper || defaultContactsHelper) && (
                        <p className="text-xs text-gray-500">
                            {contactsHelper || defaultContactsHelper}
                        </p>
                    )}
                    <ContactSelector
                        householdId={householdId}
                        value={selectedContactIds}
                        onChange={onContactsChange}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-sm font-medium text-gray-700">
                        {structuresLabel || defaultStructuresLabel}
                    </label>
                    {(structuresHelper || defaultStructuresHelper) && (
                        <p className="text-xs text-gray-500">
                            {structuresHelper || defaultStructuresHelper}
                            {autoFillStructure && (
                                <span className="block mt-1 text-blue-600">
                                    {t("forms.contactStructure.autoFillNote")}
                                </span>
                            )}
                        </p>
                    )}
                    <StructureSelector
                        householdId={householdId}
                        value={selectedStructureIds}
                        onChange={onStructuresChange}
                    />
                </div>
            </CardContent>
        </Card>
    );
}