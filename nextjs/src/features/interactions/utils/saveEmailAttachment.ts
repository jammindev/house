import type { EmailAttachment } from '@interactions/hooks/useEmailAttachments';
import type { DocumentType } from '@interactions/types';

/**
 * Save an email attachment as a standalone document
 * @param attachment - The email attachment to save
 * @param householdId - The household ID to save the document under
 * @param options - Optional settings for document creation
 * @returns The created document ID
 */
export async function saveEmailAttachmentAsDocument(
    attachment: EmailAttachment,
    householdId: string,
    options?: {
        customName?: string;
        customType?: DocumentType;
        notes?: string;
    }
): Promise<string> {
    try {
        const response = await fetch('/api/emails/attachments/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                attachmentId: attachment.id,
                householdId,
                customName: options?.customName,
                customType: options?.customType,
                notes: options?.notes,
            }),
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.error || 'Failed to save attachment as document');
        }

        return data.documentId;
    } catch (error) {
        console.error('Error saving email attachment as document:', error);
        throw error;
    }
}