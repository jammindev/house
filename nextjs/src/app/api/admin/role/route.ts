import { NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

export async function GET() {
    try {
        const supaSSR = await createSSRClient();
        const {
            data: { user },
            error: sessionError,
        } = await supaSSR.auth.getUser();

        if (sessionError || !user) {
            return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
        }

        const adminClient = await createServerAdminClient();
        const { data, error } = await adminClient
            .from("system_admins")
            .select("role")
            .eq("user_id", user.id)
            .single();

        if (error) {
            return NextResponse.json({ role: "user" });
        }

        return NextResponse.json({ role: data?.role ?? "user" });
    } catch (error) {
        console.error("Failed to resolve admin role", error);
        return NextResponse.json({ role: "user" });
    }
}

