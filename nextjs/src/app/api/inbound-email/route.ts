import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServerAdminClient } from '@/lib/supabase/serverAdminClient';

// CloudMailin form-data payload structure
interface CloudMailinPayload {
    envelope: {
        to: string;
        from: string;
        helo_domain?: string;
        remote_ip?: string;
        spf?: {
            result: string;
            domain: string;
        };
    };
    headers: {
        from: string;
        to: string;
        subject: string;
        date: string;
        message_id: string;
        received?: string[];
        [key: string]: any;
    };
    plain: string;
    html?: string;
    reply_plain?: string;
    attachments?: Array<{
        file_name: string;
        content_type: string;
        size: number;
        content: string; // base64 encoded
        disposition: string;
    }>;
}

const EMAIL_IN_ANGLE_BRACKETS = /<([^>]+)>/;

function parseEmailAddress(value?: string | null): string | null {
    if (!value) return null;
    const trimmed = value.trim();
    const match = trimmed.match(EMAIL_IN_ANGLE_BRACKETS);
    const email = match ? match[1] : trimmed;
    return email.trim().toLowerCase() || null;
}

function parseDisplayName(value?: string | null): string {
    if (!value) return '';
    const withoutEmail = value.replace(EMAIL_IN_ANGLE_BRACKETS, '').trim();
    return withoutEmail.replace(/^"(.*)"$/, '$1');
}

/**
 * Parse CloudMailin form data into our expected format
 */
async function parseCloudMailinFormData(formData: FormData): Promise<CloudMailinPayload> {
    // Parse envelope data
    const envelope: any = {
        to: formData.get('envelope[to]') as string,
        from: formData.get('envelope[from]') as string,
        helo_domain: formData.get('envelope[helo_domain]') as string || undefined,
        remote_ip: formData.get('envelope[remote_ip]') as string || undefined,
    };

    if (formData.get('envelope[spf][result]')) {
        envelope.spf = {
            result: formData.get('envelope[spf][result]') as string,
            domain: formData.get('envelope[spf][domain]') as string || ''
        };
    }

    // Parse headers
    const headers: any = {
        from: formData.get('headers[from]') as string,
        to: formData.get('headers[to]') as string,
        subject: formData.get('headers[subject]') as string || '',
        date: formData.get('headers[date]') as string,
        message_id: formData.get('headers[message_id]') as string,
    };

    // Parse received headers (array)
    const received: string[] = [];
    let i = 0;
    while (formData.get(`headers[received][${i}]`)) {
        received.push(formData.get(`headers[received][${i}]`) as string);
        i++;
    }
    if (received.length > 0) {
        headers.received = received;
    }

    // Parse body content
    const plain = formData.get('plain') as string || '';
    const html = formData.get('html') as string || '';
    const reply_plain = formData.get('reply_plain') as string || '';

    // Parse attachments - CloudMailin uses different formats
    const attachments: CloudMailinPayload['attachments'] = [];
    let attachmentIndex = 0;

    console.log('📎 Looking for attachments in form data...');

    // Try standard format first: attachments[0][filename]
    while (formData.get(`attachments[${attachmentIndex}][filename]`)) {
        console.log(`📎 Found attachment ${attachmentIndex} (standard format):`);

        const filename = formData.get(`attachments[${attachmentIndex}][filename]`) as string;
        const contentType = formData.get(`attachments[${attachmentIndex}][content_type]`) as string;
        const size = formData.get(`attachments[${attachmentIndex}][size]`) as string;
        const content = formData.get(`attachments[${attachmentIndex}][content]`) as string;
        const disposition = formData.get(`attachments[${attachmentIndex}][disposition]`) as string;

        console.log(`📎   - filename: ${filename}`);
        console.log(`📎   - content_type: ${contentType}`);
        console.log(`📎   - size: ${size}`);
        console.log(`📎   - content length: ${content?.length || 0} chars`);
        console.log(`📎   - disposition: ${disposition}`);

        const attachment = {
            file_name: filename,
            content_type: contentType,
            size: parseInt(size || '0'),
            content: content, // base64
            disposition: disposition || 'attachment'
        };
        attachments.push(attachment);
        attachmentIndex++;
    }

    // Try CloudMailin attachment_details format: attachment_details[0][filename]
    attachmentIndex = 0;
    while (formData.get(`attachment_details[${attachmentIndex}][filename]`)) {
        console.log(`📎 Found attachment ${attachmentIndex} (attachment_details format):`);

        const filename = formData.get(`attachment_details[${attachmentIndex}][filename]`) as string;
        const contentType = formData.get(`attachment_details[${attachmentIndex}][content_type]`) as string;
        const size = formData.get(`attachment_details[${attachmentIndex}][size]`) as string;
        const content = formData.get(`attachment_details[${attachmentIndex}][content]`) as string;
        const disposition = formData.get(`attachment_details[${attachmentIndex}][disposition]`) as string;

        console.log(`📎   - filename: ${filename}`);
        console.log(`📎   - content_type: ${contentType}`);
        console.log(`📎   - size: ${size}`);
        console.log(`📎   - content length: ${content?.length || 0} chars`);
        console.log(`📎   - disposition: ${disposition}`);

        const attachment = {
            file_name: filename,
            content_type: contentType,
            size: parseInt(size || '0'),
            content: content, // base64
            disposition: disposition || 'attachment'
        };
        attachments.push(attachment);
        attachmentIndex++;
    }

    // Try alternative CloudMailin format without index: attachment_details[][filename]
    if (attachments.length === 0) {
        console.log('📎 Trying alternative attachment formats...');
        const allKeys = Array.from(formData.keys());
        const attachmentKeys = allKeys.filter(key =>
            key.includes('attachment')
        );
        console.log('📎 Found attachment-related keys:', attachmentKeys);

        // Check for empty bracket format: attachment_details[][property]
        const emptyBracketKeys = attachmentKeys.filter(key => key.includes('attachment_details[]'));
        if (emptyBracketKeys.length > 0) {
            console.log('📎 Found empty bracket format keys:', emptyBracketKeys);

            // Collect all attachment properties
            const attachmentData: Record<string, string> = {};

            for (const key of emptyBracketKeys) {
                const match = key.match(/attachment_details\[\]\[([^\]]+)\]/);
                if (match) {
                    const property = match[1];
                    const value = formData.get(key) as string;
                    if (value) {
                        attachmentData[property] = value;
                        console.log(`📎   Found property ${property}: ${value}`);
                    }
                }
            }

            // Create attachment if we have enough data
            if (attachmentData.content_id || attachmentData.filename) {
                console.log('📎 Creating attachment from empty bracket format');

                const attachment = {
                    file_name: attachmentData.filename || attachmentData.content_id || 'unknown',
                    content_type: attachmentData.content_type || 'application/octet-stream',
                    size: parseInt(attachmentData.size || '0'),
                    content: attachmentData.content || '',
                    disposition: attachmentData.disposition || 'attachment'
                };

                console.log('📎 Created attachment:', {
                    filename: attachment.file_name,
                    contentType: attachment.content_type,
                    size: attachment.size,
                    contentLength: attachment.content.length
                });

                attachments.push(attachment);
            }
        }

        // Check for direct file uploads (CloudMailin might send files as separate fields)
        for (const [key, value] of formData.entries()) {
            if (value instanceof File && value.size > 0) {
                console.log(`📎 Found File object: ${key} = ${value.name} (${value.size} bytes)`);

                // Read file content as base64
                const arrayBuffer = await value.arrayBuffer();
                const base64Content = Buffer.from(arrayBuffer).toString('base64');

                const attachment = {
                    file_name: value.name,
                    content_type: value.type || 'application/octet-stream',
                    size: value.size,
                    content: base64Content,
                    disposition: 'attachment'
                };

                console.log('📎 Created attachment from File object:', {
                    filename: attachment.file_name,
                    contentType: attachment.content_type,
                    size: attachment.size,
                    contentLength: attachment.content.length
                });

                attachments.push(attachment);
            }
        }

        // Also try simple format with just property names
        const filenameKeys = attachmentKeys.filter(key => key.includes('filename'));
        for (const filenameKey of filenameKeys) {
            const baseKey = filenameKey.replace('[filename]', '');
            const filename = formData.get(filenameKey) as string;
            const contentType = formData.get(`${baseKey}[content_type]`) as string;
            const size = formData.get(`${baseKey}[size]`) as string;
            const content = formData.get(`${baseKey}[content]`) as string;
            const disposition = formData.get(`${baseKey}[disposition]`) as string;

            if (filename && !attachments.some(a => a.file_name === filename)) {
                console.log(`📎 Extracted attachment from key ${filenameKey}:`);
                console.log(`📎   - filename: ${filename}`);
                console.log(`📎   - content_type: ${contentType}`);
                console.log(`📎   - size: ${size}`);
                console.log(`📎   - content length: ${content?.length || 0} chars`);

                const attachment = {
                    file_name: filename,
                    content_type: contentType,
                    size: parseInt(size || '0'),
                    content: content,
                    disposition: disposition || 'attachment'
                };
                attachments.push(attachment);
            }
        }
    }

    console.log(`📎 Total attachments found: ${attachments.length}`);

    return {
        envelope,
        headers,
        plain,
        html,
        reply_plain,
        attachments
    };
}

/**
 * Webhook endpoint for CloudMailin inbound emails
 * POST /api/inbound-email
 */
export async function POST(request: NextRequest) {
    console.log('📧 CloudMailin webhook received');

    try {
        const contentType = request.headers.get('content-type') || '';
        console.log('📧 Content-Type:', contentType);

        let payload: CloudMailinPayload;

        // CloudMailin envoie toujours en form-data
        if (contentType.includes('multipart/form-data') || contentType.includes('application/x-www-form-urlencoded')) {
            console.log('📧 Parsing form-data payload');
            try {
                const formData = await request.formData();
                console.log('📧 Form data entries count:', Array.from(formData.entries()).length);

                // Debug: Log all form data keys to see attachment format
                const allKeys = Array.from(formData.keys());
                console.log('📧 All form data keys:', allKeys);
                console.log('📧 Attachment-related keys:', allKeys.filter(key => key.includes('attachment')));

                payload = await parseCloudMailinFormData(formData);
            } catch (err) {
                console.error('📧 Invalid form-data payload:', err);
                return NextResponse.json({ error: 'Invalid form-data payload' }, { status: 400 });
            }
        } else {
            console.error('📧 Unsupported content type:', contentType);
            return NextResponse.json({ error: 'Unsupported content type. Expected multipart/form-data' }, { status: 400 });
        }

        console.log('📧 Parsed payload envelope:', payload.envelope);
        console.log('📧 Parsed payload headers:', payload.headers);
        console.log('📧 Parsed payload plain text:', payload.plain?.substring(0, 100) + '...');

        const toEmail = parseEmailAddress(payload.envelope.to || payload.headers.to);
        const fromEmail = parseEmailAddress(payload.envelope.from || payload.headers.from);

        if (!toEmail) {
            console.error('📧 Missing recipient email in payload');
            return NextResponse.json({ error: 'Recipient email is required' }, { status: 400 });
        }

        if (!fromEmail) {
            console.error('📧 Missing sender email in payload');
            return NextResponse.json({ error: 'Sender email is required' }, { status: 400 });
        }

        const emailAlias = toEmail.split('@')[0];
        console.log('📧 Email from:', fromEmail, 'to alias:', emailAlias);

        const supabase = await createServerAdminClient();

        type HouseholdRecord = { id: string; name: string; inbound_email_alias?: string | null };
        let household: HouseholdRecord | null = null;
        let householdResolution: 'alias' | 'sender' = 'alias';

        // Chercher d'abord par alias
        if (emailAlias) {
            const { data: aliasHousehold, error: householdError } = await (supabase as any)
                .from('households')
                .select('id, name, inbound_email_alias')
                .eq('inbound_email_alias', emailAlias)
                .maybeSingle();

            if (!householdError && aliasHousehold) {
                household = aliasHousehold;
                console.log('📧 Household found by alias:', aliasHousehold.name);
            } else {
                console.warn('📧 No household found for alias, trying sender lookup:', emailAlias);
            }
        }

        // Fallback: chercher par email de l'expéditeur
        if (!household) {
            householdResolution = 'sender';

            const { data: userData, error: userError } = await supabase.auth.admin.listUsers();
            if (userError) {
                console.error('📧 Error fetching users during fallback:', userError);
            } else {
                const senderUser = userData.users.find(u => u.email?.toLowerCase() === fromEmail);
                if (senderUser) {
                    const { data: membership, error: membershipError } = await (supabase as any)
                        .from('household_members')
                        .select('household_id, households(id, name, inbound_email_alias)')
                        .eq('user_id', senderUser.id)
                        .limit(1)
                        .single();

                    if (membershipError) {
                        console.error('📧 Fallback membership lookup failed:', membershipError);
                    } else if (membership?.households) {
                        household = membership.households as HouseholdRecord;
                        console.log('📧 Household found by sender:', membership.households.name);
                    }
                } else {
                    console.warn('📧 No user found matching sender email:', fromEmail);
                }
            }
        }

        if (!household) {
            console.error('📧 No household resolved for alias or sender', { emailAlias, fromEmail });
            return NextResponse.json({
                error: 'Unknown household alias or sender',
                alias: emailAlias,
                sender: fromEmail
            }, { status: 404 });
        }

        console.log('📧 Processing email for household:', household.name);

        // Vérifier si l'email existe déjà (éviter les doublons)
        const supabaseRaw = supabase as any;
        let existingEmailData: { id: string } | null = null;

        if (payload.headers?.message_id) {
            const { data, error: existingEmailError } = await supabaseRaw
                .from('incoming_emails')
                .select('id')
                .eq('message_id', payload.headers.message_id)
                .maybeSingle();

            if (!existingEmailError && data) {
                console.log('📧 Email already processed:', payload.headers.message_id);
                return NextResponse.json({
                    status: 'duplicate',
                    message: 'Email already processed',
                    id: data.id
                });
            }
        }

        // Stocker l'email entrant
        const receivedAt = payload.headers?.date
            ? new Date(payload.headers.date).toISOString()
            : new Date().toISOString();

        const { data: incomingEmailData, error: emailError } = await supabaseRaw
            .from('incoming_emails')
            .insert({
                household_id: household.id,
                message_id: payload.headers?.message_id || crypto.randomUUID(),
                from_email: fromEmail,
                from_name: parseDisplayName(payload.headers?.from),
                to_email: toEmail,
                subject: payload.headers?.subject || '',
                body_text: payload.plain || '',
                body_html: payload.html || '',
                processing_status: 'pending',
                metadata: {
                    envelope: payload.envelope,
                    headers: payload.headers,
                    household_alias: emailAlias,
                    household_resolution_strategy: householdResolution
                },
                received_at: receivedAt
            })
            .select('id')
            .single();

        if (emailError || !incomingEmailData) {
            console.error('📧 Error storing email:', emailError);
            return NextResponse.json({ error: 'Failed to store email' }, { status: 500 });
        }

        console.log('📧 Email stored successfully with ID:', incomingEmailData.id);

        // Process and store attachments
        if (payload.attachments && payload.attachments.length > 0) {
            console.log('📎 Processing', payload.attachments.length, 'attachments for storage');

            for (let i = 0; i < payload.attachments.length; i++) {
                const attachment = payload.attachments[i];
                console.log(`📎 Storing attachment ${i + 1}/${payload.attachments.length}:`, attachment.file_name);

                try {
                    const insertData = {
                        incoming_email_id: incomingEmailData.id,
                        filename: attachment.file_name,
                        content_type: attachment.content_type,
                        size_bytes: attachment.size,
                        content_base64: attachment.content
                    };

                    console.log('📎 Insert data:', {
                        ...insertData,
                        content_base64: `${attachment.content?.length || 0} chars`
                    });

                    const { error: attachmentError } = await supabaseRaw
                        .from('incoming_email_attachments')
                        .insert(insertData);

                    if (attachmentError) {
                        console.error('📎 Error storing attachment:', attachment.file_name, attachmentError);
                    } else {
                        console.log('📎 ✅ Attachment stored successfully:', attachment.file_name);
                    }
                } catch (err) {
                    console.error('📎 Exception processing attachment:', attachment.file_name, err);
                }
            }
        } else {
            console.log('📎 No attachments to process');
        }

        console.log(incomingEmailData)
        return NextResponse.json({
            status: 'success',
            message: 'Email processed successfully',
            id: incomingEmailData.id,
            household: household.name,
            from: fromEmail,
            subject: payload.headers?.subject || '',
            resolution: householdResolution
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
        message: 'CloudMailin inbound email webhook endpoint',
        timestamp: new Date().toISOString()
    });
}
