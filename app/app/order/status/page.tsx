"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";

const UNIT_PRICE = 49500;

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

export default function OrderStatusPage() {
  const [orderNumber, setOrderNumber] = useState("");
  const [email, setEmail] = useState("");
  const [order, setOrder] = useState<any>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resubmitted, setResubmitted] = useState(false);

  async function lookup() {
    setLoading(true);
    setError(null);
    setOrder(null);
    try {
      const res = await fetch("/api/orders/lookup", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_number: orderNumber, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Could not find that order.");
      setOrder(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function resubmit() {
    if (!order) return;
    setLoading(true);
    setError(null);
    try {
      let proof_url: string | undefined;
      if (receiptFile) {
        const supabase = createClient();
        const path = `${order.order_number}/${receiptFile.name}`;
        const { error: uploadErr } = await supabase.storage
          .from("payment-receipts")
          .upload(path, receiptFile, { upsert: true });
        if (uploadErr) throw new Error("Could not upload receipt. Please try again.");
        proof_url = path;
      }

      const res = await fetch("/api/orders/confirm-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ order_id: order.order_id, proof_url }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? "Could not resubmit. Please try again.");
      }
      setResubmitted(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen bg-white px-6 py-8">
      <div className="mx-auto max-w-md">
        <h1 className="text-xl font-bold text-gray-900">Check your order</h1>
        <p className="mt-1 text-sm text-gray-500">
          Enter your order number and the email you used when ordering.
        </p>

        <div className="mt-4 space-y-3">
          <input
            placeholder="Order Number (e.g. IPA-2026-000006)"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-brand-red focus:outline-none"
          />
          <input
            placeholder="Email Address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-gray-200 px-4 py-3 text-sm focus:border-brand-red focus:outline-none"
          />
        </div>

        {error && <p className="mt-3 text-sm text-danger">{error}</p>}

        <button
          onClick={lookup}
          disabled={loading || !orderNumber || !email}
          className="mt-4 w-full rounded-lg bg-brand-red py-3 font-semibold text-white disabled:opacity-40"
        >
          {loading ? "Checking…" : "Check Status"}
        </button>

        {order && !resubmitted && (
          <section className="mt-6 rounded-xl border border-gray-100 p-5">
            <p className="text-xs font-semibold uppercase text-gray-400">
              {order.order_number}
            </p>

            {order.payment_status === "successful" && (
              <p className="mt-2 text-sm text-success">
                Payment confirmed. Fulfilment status: {order.fulfilment_status.replace(/_/g, " ")}.
              </p>
            )}

            {order.payment_status === "pending" && (
              <p className="mt-2 text-sm text-warning">
                Awaiting verification against the Academy&apos;s bank statement. You&apos;ll be
                notified once it&apos;s confirmed.
              </p>
            )}

            {order.payment_status === "failed" && (
              <>
                <p className="mt-2 text-sm text-danger">
                  We couldn&apos;t match your transfer on our statement. Please check the
                  reference and amount, then submit again below.
                </p>
                <div className="mt-3 rounded-lg bg-gray-50 p-4 text-xs text-gray-600">
                  Amount: <strong>{formatNaira(order.quantity * UNIT_PRICE)}</strong>
                  <br />
                  Reference: <strong>{order.order_number}</strong>
                </div>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  className="mt-3 w-full text-sm file:mr-3 file:rounded-md file:border-0 file:bg-brand-red file:px-4 file:py-2 file:text-sm file:font-semibold file:text-white file:cursor-pointer"
                />
                <button
                  onClick={resubmit}
                  disabled={loading}
                  className="mt-4 w-full rounded-lg bg-brand-red py-3 font-semibold text-white disabled:opacity-40"
                >
                  {loading ? "Please wait…" : "I've Made the Transfer Again"}
                </button>
              </>
            )}
          </section>
        )}

        {resubmitted && (
          <section className="mt-6 text-center">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-red-light text-2xl text-brand-red">
              ✓
            </div>
            <h2 className="mt-4 text-lg font-bold text-gray-900">Payment resubmitted</h2>
            <p className="mt-2 text-sm text-gray-600">
              Your order is back in the queue for verification.
            </p>
          </section>
        )}
      </div>
    </main>
  );
}