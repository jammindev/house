import { NextRequest, NextResponse } from 'next/server';
import { getBridgeAccessToken, bridgeFetch } from '@/lib/bridge';

/**
 * List and manage Bridge items (bank connections)
 * POST /api/bridge/items - List all items (using POST to send bridgeUserUuid)
 * DELETE /api/bridge/items - Delete old/inactive items
 */

export async function POST(req: NextRequest) {
    try {
        const { bridgeUserUuid, action } = await req.json();

        if (!bridgeUserUuid) {
            return NextResponse.json(
                { error: 'Missing bridgeUserUuid in request body' },
                { status: 400 }
            );
        }

        if (action === 'list' || !action) {
            const accessToken = await getBridgeAccessToken(bridgeUserUuid);

            // Get all items for this user
            const items = await bridgeFetch('/aggregation/items', {
                headers: {
                    Authorization: `Bearer ${accessToken}`,
                },
            });

            return NextResponse.json({
                items: items.resources || items,
                count: items.resources?.length || items.length,
                message: 'Items retrieved successfully'
            });
        }

        return NextResponse.json(
            { error: 'Invalid action' },
            { status: 400 }
        );
    } catch (error: any) {
        console.error('Bridge items error:', error);
        return NextResponse.json(
            { error: 'Failed to fetch items', details: error.message },
            { status: 500 }
        );
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const { itemIds, bridgeUserUuid } = await req.json();

        if (!itemIds || !Array.isArray(itemIds)) {
            return NextResponse.json(
                { error: 'Missing or invalid itemIds array' },
                { status: 400 }
            );
        }

        if (!bridgeUserUuid) {
            return NextResponse.json(
                { error: 'Missing bridgeUserUuid' },
                { status: 400 }
            );
        }

        const accessToken = await getBridgeAccessToken(bridgeUserUuid);

        const results = [];

        for (const itemId of itemIds) {
            try {
                await bridgeFetch(`/aggregation/items/${itemId}`, {
                    method: 'DELETE',
                    headers: {
                        Authorization: `Bearer ${accessToken}`,
                    },
                });
                results.push({ itemId, status: 'deleted' });
            } catch (error: any) {
                results.push({ itemId, status: 'error', error: error.message });
            }
        }

        return NextResponse.json({
            results,
            message: 'Items deletion completed'
        });
    } catch (error: any) {
        console.error('Bridge items deletion error:', error);
        return NextResponse.json(
            { error: 'Failed to delete items', details: error.message },
            { status: 500 }
        );
    }
}