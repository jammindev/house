import { NextRequest, NextResponse } from 'next/server';
import { getBridgeTransactions } from '@/lib/bridge';

/**
 * Get bank transactions for authenticated user
 * GET /api/bridge/transactions
 */
export async function GET(req: NextRequest) {
    try {
        const { searchParams } = new URL(req.url);
        const accessToken = searchParams.get('accessToken');
        const since = searchParams.get('since');
        const until = searchParams.get('until');
        const limit = searchParams.get('limit');

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing access token' },
                { status: 400 }
            );
        }

        const options: any = {};
        if (since) options.since = since;
        if (until) options.until = until;
        if (limit) options.limit = parseInt(limit);

        const transactions = await getBridgeTransactions(accessToken, options);

        return NextResponse.json({
            transactions,
            count: transactions.length,
            message: 'Transactions retrieved successfully'
        });
    } catch (error: any) {
        console.error('Bridge transactions error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions', details: error.message },
            { status: 500 }
        );
    }
}

/**
 * Get transactions using POST with body (more secure)
 * POST /api/bridge/transactions
 */
export async function POST(req: NextRequest) {
    try {
        const { accessToken, since, until, limit } = await req.json();

        if (!accessToken) {
            return NextResponse.json(
                { error: 'Missing access token' },
                { status: 400 }
            );
        }

        const options: any = {};
        if (since) options.since = since;
        if (until) options.until = until;
        if (limit) options.limit = limit;

        const rawTransactions = await getBridgeTransactions(accessToken, options);
        
        // Transformer les données Bridge vers notre format
        const transactions = rawTransactions.map(transaction => ({
            ...transaction,
            description: transaction.clean_description || transaction.provider_description || 'Transaction',
            category: null // Bridge ne semble pas retourner de catégories dans cette version
        }));
        
        // Log des données reçues pour debug
        console.log('=== BRIDGE TRANSACTIONS DATA ===');
        console.log('Number of transactions:', transactions.length);
        console.log('Sample transaction (first one):', JSON.stringify(transactions[0], null, 2));
        console.log('Transaction categories found:', 'None (using null for all)');
        console.log('=== END TRANSACTIONS DATA ===');

        return NextResponse.json({
            transactions,
            count: transactions.length,
            message: 'Transactions retrieved successfully'
        });
    } catch (error: any) {
        console.error('Bridge transactions error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch transactions', details: error.message },
            { status: 500 }
        );
    }
}