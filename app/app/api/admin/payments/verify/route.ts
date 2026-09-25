import { NextRequest, NextResponse } from "next/server";
import { createClient, createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  // Confirm the caller is an authenticated academy_admin.
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

  const { order_id, decision, reason } = (await req.json()) as {
    order_id: string;
    decision: "approve" | "reject";
    reason?: string;
  };

  if (!order_id || !["approve", "reject"].includes(decision)) {
    return NextResponse.json({ error: "Invalid request" }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: payment } = await supabase
    .from("payments")
    .select("id, status")
    .eq("order_id", order_id)
    .single();

  if (!payment) {
    return NextResponse.json({ error: "Payment record not found" }, { status: 404 });
  }
  if (payment.status !== "pending") {
    return NextResponse.json(
      { error: `Payment already ${payment.status}` },
      { status: 409 }
    );
  }

  if (decision === "approve") {
    await supabase
      .from("payments")
      .update({
        status: "successful",
        paid_at: new Date().toISOString(),
        verified_by: user.id,
        verified_at: new Date().toISOString(),
      })
      .eq("id", payment.id);

    await supabase
      .from("orders")
      .update({
        payment_status: "successful",
        fulfilment_status: "awaiting_books",
        updated_at: new Date().toISOString(),
      })
      .eq("id", order_id);

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      entity_type: "order",
      entity_id: order_id,
      action: "payment_manually_verified",
      new_value: { payment_status: "successful", fulfilment_status: "awaiting_books" },
      reason: "Matched against bank statement",
    });
  } else {
    await supabase
      .from("payments")
      .update({
        status: "failed",
        verified_by: user.id,
        verified_at: new Date().toISOString(),
        rejection_reason: reason ?? "Not found on bank statement",
      })
      .eq("id", payment.id);

    await supabase
      .from("orders")
      .update({ payment_status: "failed", updated_at: new Date().toISOString() })
      .eq("id", order_id);

    await supabase.from("audit_logs").insert({
      actor_id: user.id,
      entity_type: "order",
      entity_id: order_id,
      action: "payment_rejected",
      reason: reason ?? "Not found on bank statement",
    });
  }

  return NextResponse.json({ ok: true });
}
