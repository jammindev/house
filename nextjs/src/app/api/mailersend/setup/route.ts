// nextjs/src/app/api/mailersend/setup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { mailersendClient } from '@/lib/mailersend/client';

/**
 * API endpoint to manage MailerSend configuration
 * GET /api/mailersend/setup - Get current configuration
 * POST /api/mailersend/setup - Setup webhook for current environment
 */

export async function GET(request: NextRequest) {
    try {
        console.log('📧 Getting MailerSend configuration...');

        const [domains, webhooks] = await Promise.all([
            mailersendClient.getDomains(),
            mailersendClient.getWebhooks(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                domains: domains.map(d => ({
                    id: d.id,
                    name: d.name,
                    send_paused: d.domain_settings.send_paused,
                })),
                webhooks: webhooks.map(w => ({
                    id: w.id,
                    name: w.name,
                    url: w.url,
                    events: w.events,
                    enabled: w.enabled,
                })),
            },
        });
    } catch (error) {
        console.error('📧 Error getting MailerSend configuration:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { action, webhookUrl } = body;

        if (action === 'create_webhook') {
            console.log('📧 Creating MailerSend webhook for:', webhookUrl);

            const webhook = await mailersendClient.createWebhook({
                name: `House - ${process.env.NODE_ENV}`,
                url: webhookUrl,
                events: ['activity.inbound'],
                enabled: true,
            });

            return NextResponse.json({
                success: true,
                data: webhook,
                message: 'Webhook created successfully',
            });
        }

        if (action === 'test_webhook') {
            console.log('📧 Testing webhook configuration...');

            // Test webhook by getting existing webhooks
            const webhooks = await mailersendClient.getWebhooks();

            return NextResponse.json({
                success: true,
                data: { webhooks },
                message: 'Webhook test completed',
            });
        }

        return NextResponse.json({
            success: false,
            error: 'Invalid action specified',
        }, { status: 400 });

    } catch (error) {
        console.error('📧 Error setting up MailerSend:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}