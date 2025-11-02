import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    const trimmedName = typeof name === "string" ? name.trim() : "";
    if (!trimmedName) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supaSSR = await createSSRClient();
    const { data: userData, error: userErr } = await supaSSR.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: householdId, error: rpcErr } = await supaSSR.rpc(
      "create_household_with_owner",
      { p_name: trimmedName },
    );
    if (rpcErr) {
      return NextResponse.json({ error: rpcErr.message }, { status: 400 });
    }

    if (!householdId) {
      return NextResponse.json({ error: "Unexpected error" }, { status: 500 });
    }

    return NextResponse.json({ id: householdId }, { status: 201 });
  } catch (e: unknown) {
    const message = e instanceof Error ? e.message : "Unexpected error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
