import { NextRequest, NextResponse } from 'next/server';
import { getOrCreateBridgeUser } from '@/lib/bridge';

/**
 * Create or get existing Bridge user
 * POST /api/bridge/user
 */
export async function POST(req: NextRequest) {
    try {
        const { appUserId } = await req.json();

        if (!appUserId) {
            return NextResponse.json(
                { error: 'Missing appUserId' },
                { status: 400 }
            );
        }

        // Validate environment variables
        if (!process.env.BRIDGE_CLIENT_ID || !process.env.BRIDGE_CLIENT_SECRET) {
            console.error('Missing Bridge credentials');
            return NextResponse.json(
                { error: 'Bridge configuration error' },
                { status: 500 }
            );
        }

        const bridgeUserUuid = await getOrCreateBridgeUser(appUserId);

        return NextResponse.json({
            bridgeUserUuid,
            message: 'Bridge user created/retrieved successfully'
        });
    } catch (error: any) {
        console.error('Bridge user creation error:', error);
        return NextResponse.json(
            { error: 'Failed to create/get Bridge user', details: error.message },
            { status: 500 }
        );
    }
}