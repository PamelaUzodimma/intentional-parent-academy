import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { order_id, proof_url } = (await req.json()) as {
    order_id: string;
    proof_url?: string;
  };

  if (!order_id) {
    return NextResponse.json({ error: "order_id is required" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Only pending or rejected (failed) payments can be claimed or resubmitted.
  const { data: rows, error: findError } = await supabase
    .from("payments")
    .select("id, status, resubmit_count")
    .eq("order_id", order_id)
    .in("status", ["pending", "failed"])
    .limit(1);

  if (findError) {
    return NextResponse.json({ error: "Could not record payment claim" }, { status: 500 });
  }

  const payment = rows?.[0];
  if (!payment) {
    return NextResponse.json(
      { error: "This payment can no longer be updated" },
      { status: 409 }
    );
  }

  const resubmitting = payment.status === "failed";

  const update: Record<string, unknown> = {
    status: "pending",
    parent_claimed_at: new Date().toISOString(),
  };
  if (proof_url) update.proof_url = proof_url; // never wipe an existing receipt
  if (resubmitting) update.resubmit_count = (payment.resubmit_count ?? 0) + 1;

  const { error: updateError } = await supabase
    .from("payments")
    .update(update)
    .eq("id", payment.id)
    .in("status", ["pending", "failed"]);

  if (updateError) {
    return NextResponse.json({ error: "Could not record payment claim" }, { status: 500 });
  }

  if (resubmitting) {
    const { error: orderError } = await supabase
      .from("orders")
      .update({ payment_status: "pending" })
      .eq("id", order_id)
      .eq("payment_status", "failed");

    if (orderError) {
      return NextResponse.json({ error: "Could not reopen the order" }, { status: 500 });
    }
  }

  return NextResponse.json({ ok: true });
}