// nextjs/src/app/api/cloudmailin/setup/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { getCloudMailinClient } from '@/lib/cloudmailin/client';

const ADMIN_TOKEN = process.env.CLOUDMAILIN_SETUP_TOKEN ?? process.env.INTERNAL_TASK_TOKEN;

function ensureAuthorized(request: NextRequest): { status: number; body: Record<string, unknown> } | null {
    if (!ADMIN_TOKEN) {
        return {
            status: 503,
            body: {
                success: false,
                error: 'CloudMailin setup is disabled because CLOUDMAILIN_SETUP_TOKEN (or INTERNAL_TASK_TOKEN) is not configured',
            },
        };
    }

    const providedToken = request.headers.get('x-internal-task-token');
    if (!providedToken || providedToken !== ADMIN_TOKEN) {
        return {
            status: 401,
            body: {
                success: false,
                error: 'Missing or invalid admin token',
            },
        };
    }

    return null;
}

function getClientResponse(): { status: number; body: Record<string, unknown> } | { client: ReturnType<typeof getCloudMailinClient> } {
    try {
        return { client: getCloudMailinClient() };
    } catch (error) {
        return {
            status: 503,
            body: {
                success: false,
                error: error instanceof Error ? error.message : 'CloudMailin API key is not configured',
            },
        };
    }
}

/**
 * API endpoint to manage CloudMailin configuration
 * GET /api/cloudmailin/setup - Get current configuration
 * POST /api/cloudmailin/setup - Setup webhook for current environment
 */

export async function GET(request: NextRequest) {
    try {
        const authError = ensureAuthorized(request);
        if (authError) {
            return NextResponse.json(authError.body, { status: authError.status });
        }

        const clientResult = getClientResponse();
        if ('status' in clientResult) {
            return NextResponse.json(clientResult.body, { status: clientResult.status });
        }
        const cloudmailinClient = clientResult.client;

        console.log('📧 Getting CloudMailin configuration...');

        const [domains, addresses, accountInfo] = await Promise.all([
            cloudmailinClient.getDomains(),
            cloudmailinClient.getAddresses(),
            cloudmailinClient.getAccountInfo(),
        ]);

        return NextResponse.json({
            success: true,
            data: {
                account: {
                    username: accountInfo.username,
                    plan: accountInfo.plan,
                    emails_received: accountInfo.emails_received,
                    emails_forwarded: accountInfo.emails_forwarded,
                    quota_limit: accountInfo.quota_limit,
                },
                domains: domains.map(d => ({
                    id: d.id,
                    name: d.name,
                    status: d.status,
                    created_at: d.created_at,
                })),
                addresses: addresses.map(a => ({
                    id: a.id,
                    email_address: a.email_address,
                    domain_name: a.domain_name,
                    enabled: a.enabled,
                    created_at: a.created_at,
                })),
            },
        });
    } catch (error) {
        console.error('📧 Error getting CloudMailin configuration:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}

export async function POST(request: NextRequest) {
    try {
        const authError = ensureAuthorized(request);
        if (authError) {
            return NextResponse.json(authError.body, { status: authError.status });
        }

        const clientResult = getClientResponse();
        if ('status' in clientResult) {
            return NextResponse.json(clientResult.body, { status: clientResult.status });
        }
        const cloudmailinClient = clientResult.client;

        const body = await request.json();
        const { action, target_url, email_address, domain_id } = body;

        console.log('📧 CloudMailin setup action:', action);

        switch (action) {
            case 'create_address': {
                if (!email_address) {
                    return NextResponse.json({
                        success: false,
                        error: 'email_address is required for creating an address',
                    }, { status: 400 });
                }

                if (!target_url) {
                    return NextResponse.json({
                        success: false,
                        error: 'target_url is required for creating an address',
                    }, { status: 400 });
                }

                const address = await cloudmailinClient.createAddress({
                    email_address,
                    domain_id,
                    target: {
                        url: target_url,
                        secret: process.env.CLOUDMAILIN_WEBHOOK_SECRET,
                    },
                });

                return NextResponse.json({
                    success: true,
                    data: address,
                    message: `Email address ${email_address} created successfully`,
                });
            }

            case 'update_address': {
                const { address_id, enabled } = body;

                if (!address_id) {
                    return NextResponse.json({
                        success: false,
                        error: 'address_id is required for updating an address',
                    }, { status: 400 });
                }

                const updateData: Record<string, unknown> = {};
                if (typeof enabled === 'boolean') {
                    updateData.enabled = enabled;
                }
                if (target_url) {
                    updateData.target = {
                        url: target_url,
                        secret: process.env.CLOUDMAILIN_WEBHOOK_SECRET,
                    };
                }

                const address = await cloudmailinClient.updateAddress(address_id, updateData);

                return NextResponse.json({
                    success: true,
                    data: address,
                    message: `Address ${address_id} updated successfully`,
                });
            }

            case 'delete_address': {
                const { address_id } = body;

                if (!address_id) {
                    return NextResponse.json({
                        success: false,
                        error: 'address_id is required for deleting an address',
                    }, { status: 400 });
                }

                await cloudmailinClient.deleteAddress(address_id);

                return NextResponse.json({
                    success: true,
                    message: `Address ${address_id} deleted successfully`,
                });
            }

            case 'test_webhook': {
                // CloudMailin doesn't have a built-in test webhook feature
                // This would require sending a test email or using their testing tools
                return NextResponse.json({
                    success: true,
                    message: 'To test the webhook, send an email to one of your configured addresses',
                    test_instructions: {
                        step1: 'Send an email to one of your CloudMailin addresses',
                        step2: 'Check your application logs for webhook delivery',
                        step3: 'Verify the email appears in your database',
                    },
                });
            }

            default:
                return NextResponse.json({
                    success: false,
                    error: `Unknown action: ${action}`,
                    available_actions: [
                        'create_address',
                        'update_address',
                        'delete_address',
                        'test_webhook'
                    ],
                }, { status: 400 });
        }

    } catch (error) {
        console.error('📧 Error in CloudMailin setup:', error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
        }, { status: 500 });
    }
}
