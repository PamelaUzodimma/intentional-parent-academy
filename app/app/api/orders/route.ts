import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import type { ParentInfo } from "@/lib/types";

const UNIT_PRICE = 49500; // authoritative — never trust the client's total

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { quantity, parent, distributor_id } = body as {
    quantity: number;
    parent: ParentInfo;
    distributor_id: string | null;
  };

  if (!quantity || quantity < 1) {
    return NextResponse.json({ error: "Invalid quantity" }, { status: 400 });
  }
  if (!parent?.email || !parent?.delivery_address) {
    return NextResponse.json({ error: "Missing parent information" }, { status: 400 });
  }
  if (!distributor_id) {
    return NextResponse.json({ error: "A distributor must be selected" }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Confirm distributor is active — an inactive distributor cannot receive
  // new orders (PRD §39).
  const { data: distributor, error: distErr } = await supabase
    .from("distributors")
    .select("id, status")
    .eq("id", distributor_id)
    .single();

    console.log("DEBUG distributor_id received:", distributor_id);
    console.log("DEBUG distributor query result:", distributor);
    console.log("DEBUG distributor query error:", distErr);
    
  if (distErr || !distributor || distributor.status !== "active") {
    return NextResponse.json(
      { error: "Selected distributor is not currently available" },
      { status: 400 }
    );
  }

  const { data: customer, error: customerErr } = await supabase
    .from("customers")
    .insert({
      first_name: parent.first_name,
      last_name: parent.last_name,
      email: parent.email,
      phone: parent.phone,
      whatsapp_number: parent.whatsapp_number,
      country: parent.country,
      state_region: parent.state_region,
      city: parent.city,
      delivery_address: parent.delivery_address,
      postal_code: parent.postal_code,
      delivery_instructions: parent.delivery_instructions,
    })
    .select("id")
    .single();

  if (customerErr || !customer) {
    return NextResponse.json({ error: "Could not save customer details" }, { status: 500 });
  }

  const total = quantity * UNIT_PRICE;

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      customer_id: customer.id,
      distributor_id,
      quantity,
      unit_price: UNIT_PRICE,
      total_amount: total,
      payment_status: "pending",
      fulfilment_status: "pending_payment",
    })
    .select("id, order_number")
    .single();

  if (orderErr || !order) {
    return NextResponse.json({ error: "Could not create order" }, { status: 500 });
  }

  // Manual bank transfer: the order_number IS the transaction reference.
  // The parent is told to put it in the transfer narration; this is the
  // primary key admin uses to match the bank statement to this order.
  await supabase.from("payments").insert({
    order_id: order.id,
    provider: "bank_transfer",
    transaction_reference: order.order_number,
    amount: total,
    currency: "NGN",
    status: "pending",
  });

  const { data: bankAccount } = await supabase
    .from("academy_bank_accounts")
    .select("bank_name, account_name, account_number, currency")
    .eq("is_active", true)
    .limit(1)
    .single();

  return NextResponse.json({
    order_id: order.id,
    order_number: order.order_number,
    amount: total,
    bank_account: bankAccount,
  });
}
