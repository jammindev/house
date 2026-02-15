// nextjs/src/app/api/households/[householdId]/leave/route.ts

import { NextRequest, NextResponse } from 'next/server';
import { createSSRClient } from '@/lib/supabase/server';

export async function POST(
    req: NextRequest,
    { params }: { params: { householdId: string } }
) {
    try {
        const { householdId } = params;

        if (!householdId) {
            return NextResponse.json({ error: "Household ID is required" }, { status: 400 });
        }

        const supaSSR = await createSSRClient();
        const { data: userData, error: userErr } = await supaSSR.auth.getUser();

        if (userErr || !userData.user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        // Use the leave_household RPC function
        const { error: rpcErr } = await supaSSR.rpc('leave_household' as any, {
            p_household_id: householdId
        });

        if (rpcErr) {
            console.error('Leave household error:', rpcErr);
            return NextResponse.json({ error: rpcErr.message }, { status: 400 });
        }

        return NextResponse.json({ success: true });

    } catch (error) {
        console.error('Leave household error:', error);
        return NextResponse.json(
            { error: "Internal server error" },
            { status: 500 }
        );
    }
}