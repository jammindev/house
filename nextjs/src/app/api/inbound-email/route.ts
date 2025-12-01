import { NextRequest, NextResponse } from 'next/server';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';
import { headers } from 'next/headers';

// MailerSend webhook payload interface
interface MailerSendWebhookPayload {
    type: string;
    email: {
        message_id: string;
        from: {
            email: string;
            name?: string;
        };
        to: Array<{
            email: string;
            name?: string;
        }>;
        subject: string;
        text?: string;
        html?: string;
        attachments?: Array<{
            filename: string;
            content_type: string;
            size: number;
            content: string; // base64 encoded
        }>;
        headers?: Record<string, string>;
        timestamp: number;
    };
}

/**
 * Webhook endpoint for MailerSend inbound emails
 * POST /api/inbound-email
 */
export async function POST(request: NextRequest) {
    console.log('📧 MailerSend webhook received');

    try {
        // Verify the webhook signature (recommended for security)
        const headersList = await headers();
        const signature = headersList.get('x-mailersend-signature');
        const webhookSecret = process.env.MAILERSEND_WEBHOOK_SECRET;
        
        if (webhookSecret && signature) {
            // Verify signature here if MailerSend provides one
            // This is a placeholder - check MailerSend docs for exact implementation
        }

        // Parse the payload
        const payload: MailerSendWebhookPayload = await request.json();
        console.log('📧 Payload received:', { 
            type: payload.type, 
            messageId: payload.email?.message_id,
            from: payload.email?.from?.email,
            to: payload.email?.to?.[0]?.email,
            subject: payload.email?.subject 
        });

        // Only process inbound email events
        if (payload.type !== 'activity.inbound') {
            console.log('📧 Ignoring non-inbound event:', payload.type);
            return NextResponse.json({ status: 'ignored', reason: 'Not an inbound email event' });
        }

        if (!payload.email) {
            console.error('📧 No email data in payload');
            return NextResponse.json({ error: 'No email data provided' }, { status: 400 });
        }

        const email = payload.email;

        // Extract the target email address (should be something like alias@house.jammin-dev.com)
        const toEmail = email.to?.[0]?.email;
        if (!toEmail) {
            console.error('📧 No recipient email found');
            return NextResponse.json({ error: 'No recipient email found' }, { status: 400 });
        }

        // Extract alias from email (assuming format: alias@house.jammin-dev.com)
        const aliasMatch = toEmail.match(/^([^@]+)@/);
        const alias = aliasMatch?.[1];
        
        if (!alias) {
            console.error('📧 Could not extract alias from email:', toEmail);
            return NextResponse.json({ error: 'Invalid email format' }, { status: 400 });
        }

        console.log('📧 Extracted alias:', alias);

        // Create admin client for service-level operations
        const supabase = await createServerAdminClient();

        // Find the household by alias
        const { data: household, error: householdError } = await supabase
            .from('households')
            .select('id, name')
            .eq('inbound_email_alias', alias)
            .single();

        if (householdError || !household) {
            console.error('📧 Household not found for alias:', alias, householdError);
            return NextResponse.json({ 
                error: 'Household not found for email alias',
                alias: alias
            }, { status: 404 });
        }

        console.log('📧 Found household:', household.name, household.id);

        // Use raw SQL queries for the new tables until types are updated
        const supabaseRaw = supabase as any;

        // Check if we already processed this message
        const { data: existingEmailData, error: existingEmailError } = await supabaseRaw
            .from('incoming_emails')
            .select('id')
            .eq('message_id', email.message_id)
            .maybeSingle();

        if (existingEmailData) {
            console.log('📧 Email already processed:', email.message_id);
            return NextResponse.json({ 
                status: 'duplicate', 
                message: 'Email already processed',
                id: existingEmailData.id 
            });
        }

        // Store the incoming email
        const { data: incomingEmailData, error: emailError } = await supabaseRaw
            .from('incoming_emails')
            .insert({
                household_id: household.id,
                message_id: email.message_id,
                from_email: email.from.email,
                from_name: email.from.name || '',
                to_email: toEmail,
                subject: email.subject || '',
                body_text: email.text || '',
                body_html: email.html || '',
                processing_status: 'pending',
                metadata: {
                    timestamp: email.timestamp,
                    headers: email.headers || {},
                    mailersend_data: payload
                },
                received_at: new Date(email.timestamp * 1000).toISOString()
            })
            .select('id')
            .single();

        if (emailError || !incomingEmailData) {
            console.error('📧 Error storing email:', emailError);
            return NextResponse.json({ error: 'Failed to store email' }, { status: 500 });
        }

        const incomingEmailId = incomingEmailData.id;
        console.log('📧 Email stored with ID:', incomingEmailId);

        // Store attachments if any
        if (email.attachments && email.attachments.length > 0) {
            const attachmentsToInsert = email.attachments.map(attachment => ({
                incoming_email_id: incomingEmailId,
                filename: attachment.filename,
                content_type: attachment.content_type,
                size_bytes: attachment.size,
                content_base64: attachment.content,
                metadata: {
                    original_size: attachment.size
                }
            }));

            const { error: attachmentsError } = await supabaseRaw
                .from('incoming_email_attachments')
                .insert(attachmentsToInsert);

            if (attachmentsError) {
                console.error('📧 Error storing attachments:', attachmentsError);
                // Don't fail the whole process for attachment errors
            } else {
                console.log('📧 Stored', email.attachments.length, 'attachments');
            }
        }

        return NextResponse.json({
            status: 'success',
            message: 'Email processed successfully',
            id: incomingEmailId,
            household: household.name,
            attachments_count: email.attachments?.length || 0
        });

    } catch (error) {
        console.error('📧 Error processing webhook:', error);
        return NextResponse.json({ 
            error: 'Internal server error',
            details: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}

// Health check endpoint
export async function GET() {
    return NextResponse.json({
        status: 'ok',
        message: 'MailerSend inbound email webhook endpoint',
        timestamp: new Date().toISOString()
    });
}