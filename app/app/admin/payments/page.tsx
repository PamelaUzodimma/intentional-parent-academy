"use client";

import { useEffect, useState } from "react";
import { createClient } from "@/lib/supabase/client";

interface PendingPayment {
  id: string;
  order_id: string;
  transaction_reference: string;
  amount: number;
  proof_url: string | null;
  parent_claimed_at: string | null;
  resubmit_count: number;
  orders: {
    order_number: string;
    customers: {
      first_name: string;
      last_name: string;
      email: string;
      phone: string | null;
      whatsapp_number: string | null;
    } | null;
  } | null;
}

export default function PaymentVerificationPage() {
  const PAGE_SIZE = 25;

const [rows, setRows] = useState<PendingPayment[]>([]);
const [loading, setLoading] = useState(true);
const [actingOn, setActingOn] = useState<string | null>(null);
const [page, setPage] = useState(0);
const [total, setTotal] = useState(0);
const [input, setInput] = useState("");
const [q, setQ] = useState("");

async function load() {
  setLoading(true);
  const supabase = createClient();
  const term = q.replace(/[,()%*]/g, " ").trim();
  const byEmail = term.includes("@");
  const embed = byEmail
  ? "orders!inner(order_number, customers!inner(first_name, last_name, email, phone, whatsapp_number))"
  : "orders(order_number, customers(first_name, last_name, email, phone, whatsapp_number))";

  let query = supabase
    .from("payments")
    .select(
      `id, order_id, transaction_reference, amount, proof_url, parent_claimed_at, resubmit_count, ${embed}`,
      { count: "exact" }
    )
    .eq("status", "pending")
    .eq("provider", "bank_transfer")
    .not("parent_claimed_at", "is", null);

  if (term) {
    query = byEmail
      ? query.ilike("orders.customers.email", `%${term}%`)
      : query.ilike("transaction_reference", `%${term}%`);
  }

  const from = page * PAGE_SIZE;
  const { data, count } = await query
    .order("parent_claimed_at", { ascending: true })
    .range(from, from + PAGE_SIZE - 1);

  setRows((data as unknown as PendingPayment[]) ?? []);
  setTotal(count ?? 0);
  setLoading(false);

  if ((data?.length ?? 0) === 0 && page > 0) setPage(page - 1);
}

useEffect(() => {
  load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, [page, q]);

  async function decide(order_id: string, decision: "approve" | "reject") {
  let reason: string | undefined;

  if (decision === "reject") {
    const input = window.prompt("Reason for rejecting? (shown in audit log)");
    if (input === null || input.trim() === "") return; // cancelled or empty: do nothing
    reason = input.trim();
  } else {
    if (!window.confirm("Approve this payment? Only do this if it's on the bank statement.")) return;
  }

  setActingOn(order_id);
  const res = await fetch("/api/admin/payments/verify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ order_id, decision, reason }),
  });
  setActingOn(null);

  if (!res.ok) {
    window.alert("That didn't go through. Nothing was changed. Please try again.");
    return;
  }
  load();
}

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Payment Verification</h1>
      <p className="mt-1 text-sm text-gray-500">
        Parents who&apos;ve claimed a bank transfer. Match the reference and amount
        against the bank statement before approving.
      </p>

      <form
  onSubmit={(e) => {
    e.preventDefault();
    setPage(0);
    setQ(input);
  }}
  className="mt-4 flex gap-2"
>
  <input
    value={input}
    onChange={(e) => setInput(e.target.value)}
    placeholder="Search reference (IPA-2026-…) or parent email"
    className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm"
  />
  <button className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white">
    Search
  </button>
</form>
<p className="mt-3 text-sm font-semibold text-gray-700">
  {total.toLocaleString()} awaiting verification
</p>
      {loading && <p className="mt-6 text-sm text-gray-500">Loading…</p>}

      {!loading && rows.length === 0 && (
        <p className="mt-6 text-sm text-gray-500">Nothing pending verification.</p>
      )}

      <div className="mt-6 space-y-4">
        {rows.map((r) => (
          <div key={r.id} className="rounded-xl border border-gray-100 p-5">
            <div className="flex items-start justify-between">
              <div>
                <p className="font-semibold text-gray-900">
                  {r.orders?.order_number}{" "}
                  <span className="font-normal text-gray-500">
                    — {r.orders?.customers?.first_name} {r.orders?.customers?.last_name}
                  </span>
                  {r.resubmit_count > 0 && (
              <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 text-xs font-semibold text-warning">
             Resubmitted{r.resubmit_count > 1 ? ` ×${r.resubmit_count}` : ""}
            </span>
              )}
                </p>
                <p className="text-sm text-gray-600">{r.orders?.customers?.email}</p>
                <p className="text-sm text-gray-600">
                 {r.orders?.customers?.whatsapp_number || r.orders?.customers?.phone || "No phone on file"}
                </p>
              </div>
              <p className="text-lg font-bold text-brand-red">
                ₦{r.amount.toLocaleString("en-NG")}
              </p>
            </div>

            <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-gray-400">Reference to match</p>
                <p className="font-mono font-semibold">{r.transaction_reference}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-gray-400">Claimed at</p>
                <p>{r.parent_claimed_at && new Date(r.parent_claimed_at).toLocaleString()}</p>
              </div>
            </div>

            {r.proof_url && (
              <button
                onClick={async () => {
                  const res = await fetch("/api/admin/payments/receipt-url", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ path: r.proof_url }),
                  });
                  if (res.ok) {
                    const { url } = await res.json();
                    window.open(url, "_blank");
                  }
                }}
                className="mt-3 text-sm font-semibold text-brand-red underline"
              >
                View uploaded receipt
              </button>
            )}

            <div className="mt-4 flex gap-3">
              <button
                disabled={actingOn === r.order_id}
                onClick={() => decide(r.order_id, "reject")}
                className="flex-1 rounded-lg border border-gray-200 py-2 text-sm font-semibold text-gray-700 disabled:opacity-40"
              >
                Reject
              </button>
              <button
                disabled={actingOn === r.order_id}
                onClick={() => decide(r.order_id, "approve")}
                className="flex-1 rounded-lg bg-brand-red py-2 text-sm font-semibold text-white disabled:opacity-40"
              >
                Approve — Found on Statement
              </button>
            </div>
          </div>
        ))}
      </div>
      {total > PAGE_SIZE && (
  <div className="mt-6 flex items-center justify-between text-sm">
    <button
      disabled={page === 0}
      onClick={() => setPage(page - 1)}
      className="font-semibold text-brand-red disabled:opacity-30"
    >
      ← Previous
    </button>
    <span className="text-gray-500">
      Page {page + 1} of {Math.ceil(total / PAGE_SIZE)}
    </span>
    <button
      disabled={(page + 1) * PAGE_SIZE >= total}
      onClick={() => setPage(page + 1)}
      className="font-semibold text-brand-red disabled:opacity-30"
    >
      Next →
    </button>
  </div>
)}
    </main>
  );
}
