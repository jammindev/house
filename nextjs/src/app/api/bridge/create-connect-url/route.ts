import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBridgeUser, getBridgeAccessToken, createBridgeConnectSession } from '@/lib/bridge';

/**
 * Create Bridge Connect URL for bank connection
 * POST /api/bridge/create-connect-url
 */
export async function POST(req: NextRequest) {
    try {
        const { appUserId, email } = await req.json();

        console.log('Bridge Connect creation request:', { appUserId, email });

        if (!appUserId || !email) {
            return NextResponse.json(
                { error: 'Missing appUserId or email' },
                { status: 400 }
            );
        }

        // Validate email format
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return NextResponse.json(
                { error: 'Invalid email format' },
                { status: 400 }
            );
        }

        // Validate environment variables
        console.log('Environment check:', {
            hasClientId: !!process.env.BRIDGE_CLIENT_ID,
            hasClientSecret: !!process.env.BRIDGE_CLIENT_SECRET,
            hasVersion: !!process.env.BRIDGE_VERSION,
            hasApiBase: !!process.env.BRIDGE_API_BASE,
            hasCallbackUrl: !!process.env.BRIDGE_CONNECT_CALLBACK_URL,
        });

        console.log(`Creating Bridge Connect session for user: ${appUserId}, email: ${email}`);        // Step 1: Create/get Bridge user
        const bridgeUserUuid = await getOrCreateBridgeUser(appUserId);
        console.log(`Bridge user UUID: ${bridgeUserUuid}`);

        // Step 2: Get access token
        const accessToken = await getBridgeAccessToken(bridgeUserUuid);
        console.log('Access token obtained');

        // Step 3: Create Connect session
        const redirectUrl = await createBridgeConnectSession(accessToken, email);
        console.log(`Connect URL created: ${redirectUrl}`);

        return NextResponse.json({
            redirectUrl,
            bridgeUserUuid,
            message: 'Connect session created successfully'
        });
    } catch (error: any) {
        console.error('Bridge Connect creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create Connect session', details: error.message },
            { status: 500 }
        );
    }
}