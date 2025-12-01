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
function parseCloudMailinFormData(formData: FormData): CloudMailinPayload {
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

    return {
        envelope,
        headers,
        plain,
        html,
        reply_plain,
        attachments: [] // TODO: Parse attachments if needed
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
                payload = parseCloudMailinFormData(formData);
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
