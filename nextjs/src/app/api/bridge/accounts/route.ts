import { NextRequest, NextResponse } from 'next/server';
import { getBridgeAccounts } from '@/lib/bridge';

/**
 * Get bank accounts for authenticated user
 * GET /api/bridge/accounts
 */
export async function GET(req: NextRequest) {
    try {
        // TODO: Get these from your session/database based on authenticated user
        // For now, using query parameters for testing
        const { searchParams } = new URL(req.url);
        const accessToken = searchParams.get('accessToken');

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing access token' },
                { status: 400 }
            );
        }

        const accounts = await getBridgeAccounts(accessToken);

        return NextResponse.json({
            accounts,
            count: accounts.length,
            message: 'Accounts retrieved successfully'
        });
    } catch (error: any) {
        console.error('Bridge accounts error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch accounts', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get accounts using POST with body (more secure)
 * POST /api/bridge/accounts
 */
export async function POST(req: NextRequest) {
    try {
        const { accessToken } = await req.json();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing access token' },
                { status: 400 }
            );
        }

        const accounts = await getBridgeAccounts(accessToken);

        return NextResponse.json({
            accounts,
            count: accounts.length,
            message: 'Accounts retrieved successfully'
        });
    } catch (error: any) {
        console.error('Bridge accounts error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch accounts', details: error.message },
            { status: 500 }
        );
    }
}