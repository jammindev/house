// nextjs/src/features/interactions/services/transformers.ts
import type {
    Document,
    Interaction,
    InteractionContact,
    InteractionProjectSummary,
    InteractionStructure,
    InteractionTag,
} from "@interactions/types";
import type {
    DbTag,
    DbEmail,
    DbPhone,
    RawInteractionQuery,
    RawInteractionDocumentQuery,
} from "./types";
import { InteractionServiceUtils } from "./utils";

/**
 * Data transformation functions to convert raw database results to domain models
 */
export class InteractionTransformers {
    /**
     * Transform raw database interaction to domain model
     */
    static transformRawInteraction(raw: RawInteractionQuery): Interaction {
        const project: InteractionProjectSummary | null = raw.project
            ? {
                id: raw.project.id,
                title: raw.project.title?.trim() ?? "",
                status: (raw.project.status ?? "draft") as InteractionProjectSummary["status"],
            }
            : null;

        const tags: InteractionTag[] =
            raw.interaction_tags
                ?.map((entry) => entry?.tag)
                .filter((tag): tag is DbTag => Boolean(tag))
                .map(this.transformTag) ?? [];

        const contacts: InteractionContact[] =
            raw.interaction_contacts
                ?.map((link) => link?.contact)
                .filter((contact): contact is NonNullable<typeof contact> => Boolean(contact))
                .map(this.transformContact) ?? [];

        const structures: InteractionStructure[] =
            raw.interaction_structures
                ?.map((link) => link?.structure)
                .filter((structure): structure is NonNullable<typeof structure> => Boolean(structure))
                .map(this.transformStructure) ?? [];

        return {
            id: raw.id,
            household_id: raw.household_id,
            subject: raw.subject,
            content: raw.content,
            type: raw.type as Interaction["type"],
            status: raw.status as Interaction["status"],
            occurred_at: raw.occurred_at,
            project_id: raw.project_id ?? null,
            project,
            tags,
            contacts,
            structures,
            metadata: raw.metadata as Interaction["metadata"],
            enriched_text: raw.enriched_text,
            created_at: raw.created_at ?? "",
            updated_at: raw.updated_at ?? "",
            created_by: raw.created_by,
            updated_by: raw.updated_by,
        };
    }

    /**
     * Transform raw database documents to domain models
     */
    static transformRawDocuments(rawDocuments: RawInteractionDocumentQuery[]): Document[] {
        return rawDocuments
            .filter((row): row is RawInteractionDocumentQuery & { document: NonNullable<RawInteractionDocumentQuery['document']> } =>
                Boolean(row.document)
            )
            .map((row) => {
                const docRow = row.document;

                return {
                    id: docRow.id,
                    household_id: docRow.household_id,
                    file_path: docRow.file_path,
                    name: docRow.name ?? "",
                    notes: docRow.notes ?? "",
                    mime_type: docRow.mime_type ?? null,
                    type: (docRow.type ?? "document") as Document["type"],
                    metadata: docRow.metadata as Document["metadata"],
                    created_at: docRow.created_at ?? "",
                    created_by: docRow.created_by,
                    interaction_id: row.interaction_id,
                    link_role: row.role,
                    link_note: row.note,
                    link_created_at: row.created_at,
                } satisfies Document;
            });
    }

    /**
     * Transform database tag to domain model
     */
    private static transformTag(tag: DbTag): InteractionTag {
        return {
            id: tag.id,
            household_id: tag.household_id,
            type: tag.type as InteractionTag["type"],
            name: tag.name,
            created_at: tag.created_at,
            created_by: tag.created_by,
        };
    }

    /**
     * Transform database contact to domain model
     */
    private static transformContact(contact: NonNullable<RawInteractionQuery["interaction_contacts"]>[0]["contact"]): InteractionContact {
        if (!contact) throw new Error("Contact is null");

        return {
            id: contact.id,
            first_name: InteractionServiceUtils.normalizeText(contact.first_name) ?? "",
            last_name: InteractionServiceUtils.normalizeText(contact.last_name) ?? "",
            position: InteractionServiceUtils.normalizeText(contact.position),
            structure: contact.structure
                ? {
                    id: contact.structure.id,
                    name: InteractionServiceUtils.normalizeText(contact.structure.name) ?? "",
                    type: InteractionServiceUtils.normalizeText(contact.structure.type),
                }
                : null,
            emails: contact.emails?.map(this.transformContactEmail) ?? [],
            phones: contact.phones?.map(this.transformContactPhone) ?? [],
        };
    }

    /**
     * Transform database structure to domain model
     */
    private static transformStructure(structure: NonNullable<RawInteractionQuery["interaction_structures"]>[0]["structure"]): InteractionStructure {
        if (!structure) throw new Error("Structure is null");

        return {
            id: structure.id,
            name: InteractionServiceUtils.normalizeText(structure.name) ?? "",
            type: InteractionServiceUtils.normalizeText(structure.type),
            emails: structure.emails?.map(this.transformStructureEmail) ?? [],
            phones: structure.phones?.map(this.transformStructurePhone) ?? [],
        };
    }

    /**
     * Transform database email to contact email
     */
    private static transformContactEmail(email: DbEmail) {
        return {
            id: email.id,
            email: InteractionServiceUtils.normalizeText(email.email) ?? "",
            label: InteractionServiceUtils.normalizeText(email.label),
            is_primary: InteractionServiceUtils.normalizeBoolean(email.is_primary),
            created_at: email.created_at ?? null,
        };
    }

    /**
     * Transform database phone to contact phone
     */
    private static transformContactPhone(phone: DbPhone) {
        return {
            id: phone.id,
            phone: InteractionServiceUtils.normalizeText(phone.phone) ?? "",
            label: InteractionServiceUtils.normalizeText(phone.label),
            is_primary: InteractionServiceUtils.normalizeBoolean(phone.is_primary),
            created_at: phone.created_at ?? null,
        };
    }

    /**
     * Transform database email to structure email
     */
    private static transformStructureEmail(email: DbEmail) {
        return {
            id: email.id,
            email: InteractionServiceUtils.normalizeText(email.email) ?? "",
            label: InteractionServiceUtils.normalizeText(email.label),
            is_primary: InteractionServiceUtils.normalizeBoolean(email.is_primary),
            created_at: email.created_at ?? null,
        };
    }

    /**
     * Transform database phone to structure phone
     */
    private static transformStructurePhone(phone: DbPhone) {
        return {
            id: phone.id,
            phone: InteractionServiceUtils.normalizeText(phone.phone) ?? "",
            label: InteractionServiceUtils.normalizeText(phone.label),
            is_primary: InteractionServiceUtils.normalizeBoolean(phone.is_primary),
            created_at: phone.created_at ?? null,
        };
    }
}