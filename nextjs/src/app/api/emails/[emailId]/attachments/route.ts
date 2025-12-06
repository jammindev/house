import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

/**
 * GET /api/emails/[emailId]/attachments
 * Fetch attachments for a specific email
 */
export async function GET(
    request: NextRequest,
    { params }: { params: { emailId: string } }
) {
    try {
        const { emailId } = params;

        if (!emailId) {
            return NextResponse.json({ error: 'Email ID is required' }, { status: 400 });
        }

        const supabase = await createServerAdminClient();

        const { data, error } = await (supabase as any)
            .from('incoming_email_attachments')
            .select('*')
            .eq('incoming_email_id', emailId)
            .order('created_at');

        if (error) {
            console.error('Error fetching email attachments:', error);
            return NextResponse.json({ error: 'Failed to fetch attachments' }, { status: 500 });
        }

        return NextResponse.json({ attachments: data || [] });
    } catch (error) {
        console.error('Error in email attachments API:', error);
        return NextResponse.json({
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}