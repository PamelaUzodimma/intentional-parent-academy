import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const authed = await createClient();
  const {
    data: { user },
  } = await authed.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { data: profile } = await authed
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "academy_admin" && profile?.role !== "payment_verifier") {
    return NextResponse.json({ error: "Not authorized" }, { status: 403 });
  }

  const { path } = (await req.json()) as { path: string };
  if (!path) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("payment-receipts")
    .createSignedUrl(path, 60 * 5); // 5 minutes

  if (error || !data) {
    return NextResponse.json({ error: "Could not sign URL" }, { status: 500 });
  }

  return NextResponse.json({ url: data.signedUrl });
}
