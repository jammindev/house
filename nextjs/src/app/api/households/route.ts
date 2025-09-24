import { NextRequest, NextResponse } from "next/server";
import { createSSRClient } from "@/lib/supabase/server";
import { createServerAdminClient } from "@/lib/supabase/serverAdminClient";

export async function POST(req: NextRequest) {
  try {
    const { name } = await req.json();
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json({ error: "Name is required" }, { status: 400 });
    }

    const supaSSR = await createSSRClient();
    const { data: userData, error: userErr } = await supaSSR.auth.getUser();
    if (userErr || !userData.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const userId = userData.user.id;

    const admin = await createServerAdminClient();

    const { data: hh, error: hErr } = await admin
      .from("households" as any)
      .insert({ name: name.trim() })
      .select("id")
      .single();
    if (hErr) {
      return NextResponse.json({ error: hErr.message }, { status: 400 });
    }

    const { error: mErr } = await admin
      .from("household_members" as any)
      .insert({ household_id: hh.id, user_id: userId, role: "owner" });
    if (mErr) {
      return NextResponse.json({ error: mErr.message }, { status: 400 });
    }

    return NextResponse.json({ id: hh.id }, { status: 201 });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Unexpected error" }, { status: 500 });
  }
}

