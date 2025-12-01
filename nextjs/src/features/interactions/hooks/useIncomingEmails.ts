import { useState, useEffect } from 'react';
import { createSPASassClientAuthenticated } from '@/lib/supabase/client';
import { useI18n } from '@/lib/i18n/I18nProvider';
import { useGlobal } from '@/lib/context/GlobalContext';

// Types for incoming emails
export interface IncomingEmailAttachment {
    id: string;
    incoming_email_id: string;
    filename: string;
    content_type: string | null;
    size_bytes: number | null;
    content_base64: string;
    document_id: string | null;
    metadata: Record<string, any> | null;
    created_at: string;
}

export interface IncomingEmail {
    id: string;
    household_id: string;
    message_id: string;
    from_email: string;
    from_name: string;
    to_email: string;
    subject: string;
    body_text: string;
    body_html: string;
    processing_status: 'pending' | 'processing' | 'completed' | 'failed' | 'ignored';
    processing_error: string | null;
    interaction_id: string | null;
    metadata: Record<string, any> | null;
    received_at: string;
    processed_at: string | null;
    created_at: string;
    updated_at: string;
    attachments: IncomingEmailAttachment[];
}

interface UseIncomingEmailsReturn {
    emails: IncomingEmail[];
    loading: boolean;
    error: string;
    refreshEmails: () => Promise<void>;
    markAsIgnored: (emailId: string) => Promise<void>;
    markAsProcessing: (emailId: string) => Promise<void>;
    getUnreadCount: () => number;
}

export function useIncomingEmails(): UseIncomingEmailsReturn {
    const { t } = useI18n();
    const { selectedHouseholdId: householdId } = useGlobal();
    const [emails, setEmails] = useState<IncomingEmail[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const loadEmails = async () => {
        if (!householdId) {
            setEmails([]);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError('');

        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient() as any; // Use any to bypass type checking for new tables

            // Fetch incoming emails with attachments
            const { data: emailsData, error: emailsError } = await client
                .from('incoming_emails')
                .select(`
          id,
          household_id,
          message_id,
          from_email,
          from_name,
          to_email,
          subject,
          body_text,
          body_html,
          processing_status,
          processing_error,
          interaction_id,
          metadata,
          received_at,
          processed_at,
          created_at,
          updated_at
        `)
                .eq('household_id', householdId)
                .order('received_at', { ascending: false })
                .limit(50);

            if (emailsError) {
                throw emailsError;
            }

            // Fetch attachments for all emails
            const emailIds = emailsData?.map((email: any) => email.id) || [];
            let attachmentsData: any[] = [];

            if (emailIds.length > 0) {
                const { data: attachments, error: attachmentsError } = await client
                    .from('incoming_email_attachments')
                    .select(`
            id,
            incoming_email_id,
            filename,
            content_type,
            size_bytes,
            content_base64,
            document_id,
            metadata,
            created_at
          `)
                    .in('incoming_email_id', emailIds);

                if (!attachmentsError) {
                    attachmentsData = attachments || [];
                }
            }

            // Group attachments by email ID
            const attachmentsByEmail: Record<string, IncomingEmailAttachment[]> = {};
            attachmentsData.forEach((attachment) => {
                const emailId = attachment.incoming_email_id;
                if (!attachmentsByEmail[emailId]) {
                    attachmentsByEmail[emailId] = [];
                }
                attachmentsByEmail[emailId].push(attachment);
            });

            // Combine emails with their attachments
            const emailsWithAttachments: IncomingEmail[] = (emailsData || []).map((email: any) => ({
                ...email,
                attachments: attachmentsByEmail[email.id] || []
            }));

            setEmails(emailsWithAttachments);
        } catch (err) {
            console.error('Error loading incoming emails:', err);
            setError(err instanceof Error ? err.message : t('common.unexpectedError'));
        } finally {
            setLoading(false);
        }
    };

    const markAsIgnored = async (emailId: string) => {
        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient() as any;

            const { error: updateError } = await client
                .from('incoming_emails')
                .update({
                    processing_status: 'ignored',
                    processed_at: new Date().toISOString()
                })
                .eq('id', emailId);

            if (updateError) {
                throw updateError;
            }

            // Update local state
            setEmails(prevEmails =>
                prevEmails.map(email =>
                    email.id === emailId
                        ? { ...email, processing_status: 'ignored' as const, processed_at: new Date().toISOString() }
                        : email
                )
            );
        } catch (err) {
            console.error('Error marking email as ignored:', err);
            setError(err instanceof Error ? err.message : t('common.unexpectedError'));
        }
    };

    const markAsProcessing = async (emailId: string) => {
        try {
            const supa = await createSPASassClientAuthenticated();
            const client = supa.getSupabaseClient() as any;

            const { error: updateError } = await client
                .from('incoming_emails')
                .update({
                    processing_status: 'processing'
                })
                .eq('id', emailId);

            if (updateError) {
                throw updateError;
            }

            // Update local state
            setEmails(prevEmails =>
                prevEmails.map(email =>
                    email.id === emailId
                        ? { ...email, processing_status: 'processing' as const }
                        : email
                )
            );
        } catch (err) {
            console.error('Error marking email as processing:', err);
            setError(err instanceof Error ? err.message : t('common.unexpectedError'));
        }
    };

    const getUnreadCount = () => {
        return emails.filter(email => email.processing_status === 'pending').length;
    };

    // Load emails when household changes
    useEffect(() => {
        loadEmails();
    }, [householdId]);

    return {
        emails,
        loading,
        error,
        refreshEmails: loadEmails,
        markAsIgnored,
        markAsProcessing,
        getUnreadCount
    };
}