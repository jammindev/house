"use client";

import { useState, useEffect, useCallback } from 'react';

export interface EmailAttachment {
    id: string;
    incoming_email_id: string;
    filename: string;
    content_type: string | null;
    size_bytes: bigint | null;
    content_base64: string | null;
    document_id: string | null; // Set when attachment is saved as document
    created_at: string;
}

export function useEmailAttachments(emailId?: string) {
    const [attachments, setAttachments] = useState<EmailAttachment[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const fetchAttachments = useCallback(async () => {
        if (!emailId) {
            setAttachments([]);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const response = await fetch(`/api/emails/${emailId}/attachments`);
            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to fetch attachments');
            }

            setAttachments(data.attachments || []);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to fetch attachments');
            setAttachments([]);
        } finally {
            setLoading(false);
        }
    }, [emailId]);

    // Mark attachment as saved (with document_id)
    const markAsSaved = useCallback(async (attachmentId: string, documentId: string) => {
        try {
            const response = await fetch(`/api/emails/attachments/${attachmentId}`, {
                method: 'PATCH',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    document_id: documentId
                }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.error || 'Failed to mark attachment as saved');
            }

            // Update local state
            setAttachments(prev =>
                prev.map(att =>
                    att.id === attachmentId
                        ? { ...att, document_id: documentId }
                        : att
                )
            );
        } catch (err) {
            throw new Error(err instanceof Error ? err.message : 'Failed to mark attachment as saved');
        }
    }, []);

    useEffect(() => {
        void fetchAttachments();
    }, [fetchAttachments]);

    return {
        attachments,
        loading,
        error,
        refetch: fetchAttachments,
        markAsSaved
    };
}