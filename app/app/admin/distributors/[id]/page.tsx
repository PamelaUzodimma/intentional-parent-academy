"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

interface DistributorInfo {
  id: string;
  name: string;
  business_name: string | null;
  city: string | null;
  state_region: string | null;
  country: string;
  phone: string | null;
}

interface PickupOrder {
  order_number: string;
  quantity: number;
  payment_status: string;
  customers: { first_name: string; last_name: string; phone: string } | null;
}

export default function DistributorDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [distributor, setDistributor] = useState<DistributorInfo | null>(null);
  const [orders, setOrders] = useState<PickupOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const [{ data: dist }, { data: ord }] = await Promise.all([
        supabase
          .from("distributors")
          .select("id, name, business_name, city, state_region, country, phone")
          .eq("id", id)
          .single(),
        supabase
          .from("orders")
          .select("order_number, quantity, payment_status, customers(first_name, last_name, phone)")
          .eq("distributor_id", id)
          .eq("payment_status", "successful")
          .order("created_at", { ascending: true }),
      ]);
      setDistributor(dist as DistributorInfo);
      setOrders((ord as unknown as PickupOrder[]) ?? []);
      setLoading(false);
    }
    load();
  }, [id]);

  const totalPackages = orders.reduce((s, o) => s + o.quantity, 0);

  function buildText() {
    const lines = orders.map(
      (o, i) =>
        `${i + 1}. ${o.customers?.first_name} ${o.customers?.last_name} — ${o.quantity} bundle(s) — ${o.order_number}${
          o.customers?.phone ? ` — ${o.customers.phone}` : ""
        }`
    );
    return [
      `Pickup list for ${distributor?.name}`,
      `Total: ${orders.length} orders, ${totalPackages} bundles`,
      "",
      ...lines,
    ].join("\n");
  }

  async function copyList() {
    await navigator.clipboard.writeText(buildText());
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function downloadCsv() {
    const header = "Order Number,Parent Name,Phone,Quantity\n";
    const rows = orders
      .map(
        (o) =>
          `${o.order_number},"${o.customers?.first_name} ${o.customers?.last_name}",${o.customers?.phone ?? ""},${o.quantity}`
      )
      .join("\n");
    const blob = new Blob([header + rows], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${distributor?.name ?? "distributor"}-pickup-list.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <main className="p-8">
        <p className="text-sm text-gray-500">Loading…</p>
      </main>
    );
  }

  if (!distributor) {
    return (
      <main className="p-8">
        <p className="text-sm text-danger">Distributor not found.</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">{distributor.name}</h1>
      <p className="mt-1 text-sm text-gray-500">
        {[distributor.city, distributor.state_region, distributor.country]
          .filter(Boolean)
          .join(", ")}
        {distributor.phone && ` · ${distributor.phone}`}
      </p>

      <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold uppercase text-gray-400">Orders</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{orders.length}</p>
        </div>
        <div className="rounded-xl border border-gray-100 p-5">
          <p className="text-xs font-semibold uppercase text-gray-400">Packages Required</p>
          <p className="mt-1 text-2xl font-bold text-gray-900">{totalPackages}</p>
        </div>
      </div>

      <div className="mt-6 flex gap-3">
        <button
          onClick={copyList}
          className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white"
        >
          {copied ? "Copied!" : "Copy List (for WhatsApp)"}
        </button>
        <button
          onClick={downloadCsv}
          className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
        >
          Download CSV
        </button>
      </div>

      <p className="mt-3 text-xs text-gray-400">
        Only paid orders are listed — this distributor has no login, so this is
        what you'd share with them directly.
      </p>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Order</th>
            <th className="py-2">Name</th>
            <th className="py-2">Phone</th>
            <th className="py-2 text-right">Qty</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_number} className="border-b border-gray-100">
              <td className="py-3 font-mono">{o.order_number}</td>
              <td className="py-3">
                {o.customers?.first_name} {o.customers?.last_name}
              </td>
              <td className="py-3 text-gray-600">{o.customers?.phone}</td>
              <td className="py-3 text-right">{o.quantity}</td>
            </tr>
          ))}
          {orders.length === 0 && (
            <tr>
              <td colSpan={4} className="py-6 text-center text-gray-400">
                No paid orders for this distributor yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </main>
  );
}
