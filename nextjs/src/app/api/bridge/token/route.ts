import { NextRequest, NextResponse } from 'next/server';
import { getBridgeAccessToken } from '@/lib/bridge';

/**
 * Get authorization token for Bridge user
 * POST /api/bridge/token
 */
export async function POST(req: NextRequest) {
    try {
        const { bridgeUserUuid } = await req.json();

        if (!bridgeUserUuid) {
            return NextResponse.json(
                { error: 'Missing bridgeUserUuid' },
                { status: 400 }
            );
        }

        const accessToken = await getBridgeAccessToken(bridgeUserUuid);

        // TODO: Store the access_token in your database with expiration
        // await db.bridgeUser.update({ 
        //   where: { bridgeUserUuid }, 
        //   data: { accessToken, tokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) } 
        // });

        return NextResponse.json({
            accessToken,
            message: 'Access token generated successfully'
        });
    } catch (error: any) {
        console.error('Bridge token error:', error);
        return NextResponse.json(
            { error: 'Failed to get Bridge token', details: error.message },
            { status: 500 }
        );
    }
}