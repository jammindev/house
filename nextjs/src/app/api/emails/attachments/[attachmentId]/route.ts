import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

/**
 * PATCH /api/emails/attachments/[attachmentId]
 * Mark attachment as saved with document_id
 */
export async function PATCH(
    request: NextRequest,
    { params }: { params: { attachmentId: string } }
) {
    try {
        const { attachmentId } = params;
        const { document_id } = await request.json();

        if (!attachmentId || !document_id) {
            return NextResponse.json({
                error: 'Attachment ID and document_id are required'
            }, { status: 400 });
        }

        const supabase = await createServerAdminClient();

        const { error } = await (supabase as any)
            .from('incoming_email_attachments')
            .update({ document_id })
            .eq('id', attachmentId);

        if (error) {
            console.error('Error updating attachment:', error);
            return NextResponse.json({ error: 'Failed to update attachment' }, { status: 500 });
        }

        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error in attachment update API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}