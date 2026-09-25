import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export async function POST(req: NextRequest) {
  const { order_number, email } = (await req.json()) as {
    order_number?: string;
    email?: string;
  };

  if (!order_number || !email) {
    return NextResponse.json({ error: "Order number and email are required" }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from("orders")
    .select("id, order_number, quantity, payment_status, fulfilment_status, customers!inner(email)")
    .eq("order_number", order_number.trim())
    .ilike("customers.email", email.trim())
    .maybeSingle();

  if (error || !data) {
    return NextResponse.json({ error: "No order found with that number and email" }, { status: 404 });
  }

  const { data: bank } = await supabase
    .from("academy_bank_accounts")
    .select("bank_name, account_name, account_number, currency")
    .limit(1)
    .maybeSingle();

  return NextResponse.json({
    order_id: data.id,
    order_number: data.order_number,
    quantity: data.quantity,
    payment_status: data.payment_status,
    fulfilment_status: data.fulfilment_status,
    bank_account: bank ?? null,
  });
}