import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import crypto from 'crypto';

// Helper to infer document type from filename/content-type
function inferDocumentType(filename: string, contentType?: string | null): string {
    const name = filename.toLowerCase();
    const type = contentType?.toLowerCase() || '';

    // Check filename patterns
    if (name.includes('devis') || name.includes('quote') || name.includes('estimation')) {
        return 'quote';
    }
    if (name.includes('facture') || name.includes('invoice') || name.includes('bill')) {
        return 'invoice';
    }
    if (name.includes('contrat') || name.includes('contract') || name.includes('agreement')) {
        return 'contract';
    }

    // Check content type
    if (type.startsWith('image/')) {
        return 'photo';
    }

    // Default to document
    return 'document';
}

// Helper to sanitize filename
function sanitizeFilename(filename: string): string {
    return filename.replace(/[^a-zA-Z0-9.-]/g, '_');
}

// Helper to generate unique filename
function generateUniqueFilename(originalFilename: string): string {
    const uuid = crypto.randomUUID();
    const sanitized = sanitizeFilename(originalFilename);
    return `${uuid}_${sanitized}`;
}

/**
 * POST /api/emails/attachments/save
 * Save an email attachment as a standalone document
 */
export async function POST(request: NextRequest) {
    try {
        const {
            attachmentId,
            householdId,
            customName,
            customType,
            notes
        } = await request.json();

        if (!attachmentId || !householdId) {
            return NextResponse.json({
                error: 'attachmentId and householdId are required'
            }, { status: 400 });
        }

        const supabase = await createSSRClient();
        const adminClient = await createServerAdminClient();

        // 1. Fetch attachment data using admin client (since it's in a separate table)
        const { data: attachment, error: fetchError } = await (adminClient as any)
            .from('incoming_email_attachments')
            .select('*')
            .eq('id', attachmentId)
            .single();

        if (fetchError || !attachment) {
            return NextResponse.json({
                error: 'Attachment not found'
            }, { status: 404 });
        }

        if (!attachment.content_base64) {
            return NextResponse.json({
                error: 'Attachment content is missing'
            }, { status: 400 });
        }

        // 2. Decode base64 content
        const buffer = Buffer.from(attachment.content_base64, 'base64');

        // 3. Generate storage path
        const uniqueFilename = generateUniqueFilename(attachment.filename);
        const storagePath = `${householdId}/email-attachments/${uniqueFilename}`;

        // 4. Upload to Supabase Storage using admin client (for storage access)
        const { error: uploadError } = await adminClient.storage
            .from('files')
            .upload(storagePath, buffer, {
                contentType: attachment.content_type || undefined,
                cacheControl: '3600',
                upsert: false,
            });

        if (uploadError) {
            return NextResponse.json({
                error: `Upload failed: ${uploadError.message}`
            }, { status: 500 });
        }

        // 5. Create document record using authenticated client (for proper user context)
        const documentType = customType || inferDocumentType(
            attachment.filename,
            attachment.content_type
        );

        const { data: document, error: documentError } = await (supabase as any)
            .from('documents')
            .insert({
                household_id: householdId,
                file_path: storagePath,
                name: customName || attachment.filename,
                notes: notes || '',
                mime_type: attachment.content_type,
                type: documentType,
                metadata: {
                    source: 'email_attachment',
                    original_filename: attachment.filename,
                    email_attachment_id: attachment.id,
                    size_bytes: attachment.size_bytes ? Number(attachment.size_bytes) : null,
                }
            })
            .select('id')
            .single();

        if (documentError) {
            // Cleanup uploaded file on document creation failure
            await adminClient.storage.from('files').remove([storagePath]);
            return NextResponse.json({
                error: `Document creation failed: ${documentError.message}`
            }, { status: 500 });
        }

        if (!document?.id) {
            // Cleanup uploaded file
            await adminClient.storage.from('files').remove([storagePath]);
            return NextResponse.json({
                error: 'Document creation failed: No ID returned'
            }, { status: 500 });
        }

        // 6. Mark attachment as saved using admin client
        const { error: updateError } = await (adminClient as any)
            .from('incoming_email_attachments')
            .update({ document_id: document.id })
            .eq('id', attachmentId);

        if (updateError) {
            console.error('Error marking attachment as saved:', updateError);
            // Don't fail the request, document is created successfully
        }

        console.log(`📎 Successfully saved attachment ${attachment.filename} as document ${document.id}`);

        return NextResponse.json({
            success: true,
            documentId: document.id,
            message: 'Attachment saved as document'
        });

    } catch (error) {
        console.error('Error saving email attachment as document:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}