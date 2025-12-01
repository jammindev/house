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

        const rawAccounts = await getBridgeAccounts(accessToken);

        // Même logique de filtrage que la route POST
        const itemGroups = rawAccounts.reduce((acc, account) => {
            if (!acc[account.item_id]) acc[account.item_id] = [];
            acc[account.item_id].push(account);
            return acc;
        }, {} as Record<number, any[]>);

        const validItems = Object.entries(itemGroups)
            .map(([itemId, accounts]) => {
                const hasBalances = accounts.some(acc => acc.balance !== undefined);
                const hasEnabledAccess = accounts.some(acc => acc.data_access === 'enabled');
                const notPaused = accounts.every(acc => !acc.paused);
                const avgUpdateTime = accounts.reduce((sum, acc) => sum + new Date(acc.updated_at).getTime(), 0) / accounts.length;

                return {
                    itemId: parseInt(itemId),
                    accounts,
                    score: (hasBalances ? 100 : 0) + (hasEnabledAccess ? 50 : 0) + (notPaused ? 25 : 0),
                    avgUpdateTime
                };
            })
            .filter(item => item.score > 0)
            .sort((a, b) => {
                if (b.score !== a.score) return b.score - a.score;
                return b.avgUpdateTime - a.avgUpdateTime;
            });

        const bestItem = validItems[0];
        const accounts = bestItem ? bestItem.accounts.filter(acc =>
            acc.data_access === 'enabled' || acc.balance !== undefined
        ) : [];

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

        const rawAccounts = await getBridgeAccounts(accessToken);

        // Filtrer et dédupliquer les comptes selon la logique Bridge
        // 1. Grouper par item_id (connexion bancaire)
        // 2. Pour chaque item, vérifier s'il est actif et a des données
        // 3. Garder seulement les comptes de l'item le plus récent avec des balances

        // Grouper par item_id
        const itemGroups = rawAccounts.reduce((acc, account) => {
            if (!acc[account.item_id]) acc[account.item_id] = [];
            acc[account.item_id].push(account);
            return acc;
        }, {} as Record<number, any[]>);

        // Pour chaque groupe, vérifier la qualité de l'item
        const validItems = Object.entries(itemGroups)
            .map(([itemId, accounts]) => {
                // Calculer le score de l'item
                const hasBalances = accounts.some(acc => acc.balance !== undefined);
                const hasEnabledAccess = accounts.some(acc => acc.data_access === 'enabled');
                const notPaused = accounts.every(acc => !acc.paused);
                const avgUpdateTime = accounts.reduce((sum, acc) => sum + new Date(acc.updated_at).getTime(), 0) / accounts.length;

                return {
                    itemId: parseInt(itemId),
                    accounts,
                    score: (hasBalances ? 100 : 0) + (hasEnabledAccess ? 50 : 0) + (notPaused ? 25 : 0),
                    avgUpdateTime,
                    hasBalances,
                    hasEnabledAccess
                };
            })
            .filter(item => item.score > 0) // Garder seulement les items valides
            .sort((a, b) => {
                // Trier par score descendant, puis par date de mise à jour descendante
                if (b.score !== a.score) return b.score - a.score;
                return b.avgUpdateTime - a.avgUpdateTime;
            });

        // Prendre le meilleur item (le premier après tri)
        const bestItem = validItems[0];
        const accounts = bestItem ? bestItem.accounts.filter(acc =>
            // Filtrer les comptes individuels du meilleur item
            acc.data_access === 'enabled' || acc.balance !== undefined
        ) : [];

        // Log des données reçues pour debug
        console.log('=== BRIDGE ACCOUNTS DATA ===');
        console.log('Raw accounts count:', rawAccounts.length);
        console.log('Items found:', Object.keys(itemGroups).length);
        console.log('Valid items:', validItems.map(item => ({
            itemId: item.itemId,
            score: item.score,
            accountCount: item.accounts.length,
            hasBalances: item.hasBalances,
            hasEnabledAccess: item.hasEnabledAccess
        })));
        console.log('Best item selected:', bestItem?.itemId);
        console.log('Final accounts count:', accounts.length);
        console.log('Final accounts:', accounts.map(acc => ({
            id: acc.id,
            name: acc.name,
            balance: acc.balance,
            item_id: acc.item_id,
            data_access: acc.data_access
        })));
        console.log('=== END ACCOUNTS DATA ===');

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