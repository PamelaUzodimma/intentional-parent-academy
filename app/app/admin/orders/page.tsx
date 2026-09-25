import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface OrderRow {
  order_number: string;
  quantity: number;
  payment_status: string;
  fulfilment_status: string;
  created_at: string;
  customers: { first_name: string; last_name: string; country: string } | null;
  distributors: { name: string } | null;
}

const PAGE_SIZE = 50;

const PAYMENT_BADGE: Record<string, string> = {
  successful: "bg-green-50 text-success",
  pending: "bg-amber-50 text-warning",
  failed: "bg-red-50 text-danger",
  cancelled: "bg-gray-100 text-gray-500",
  refunded: "bg-gray-100 text-gray-500",
};

async function getOrders(page: number, q: string) {
  const supabase = await createClient();
  const term = q.replace(/[,()%*]/g, " ").trim();

  let query = supabase
    .from("orders")
    .select(
      "order_number, quantity, payment_status, fulfilment_status, created_at, customers(first_name, last_name, country), distributors(name)",
      { count: "exact" }
    );

  if (term) {
    const { data: matches } = await supabase
      .from("customers")
      .select("id")
      .or(`first_name.ilike.%${term}%,last_name.ilike.%${term}%,email.ilike.%${term}%`)
      .limit(200);
    const ids = (matches ?? []).map((m) => m.id);

    query = ids.length
      ? query.or(`order_number.ilike.%${term}%,customer_id.in.(${ids.join(",")})`)
      : query.ilike("order_number", `%${term}%`);
  }

  const from = page * PAGE_SIZE;
  const { data, count, error } = await query
    .order("created_at", { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (error) {
    console.error(error);
    return { orders: [] as OrderRow[], total: 0 };
  }
  return { orders: data as unknown as OrderRow[], total: count ?? 0 };
}

export default async function OrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string; q?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.q ?? "";
  const page = Math.max(0, (parseInt(sp.page ?? "1", 10) || 1) - 1);
  const { orders, total } = await getOrders(page, q);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const link = (p: number) =>
    `/admin/orders?page=${p}${q ? `&q=${encodeURIComponent(q)}` : ""}`;

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Orders</h1>
      <p className="mt-1 text-sm text-gray-500">
        {total.toLocaleString()} order{total === 1 ? "" : "s"}
        {q ? ` matching “${q}”` : ""}, newest first.
      </p>

      <form method="GET" className="mt-4 flex gap-2">
        <input
          name="q"
          defaultValue={q}
          placeholder="Search order number, name or email"
          className="w-full max-w-sm rounded-lg border border-gray-200 px-3 py-2 text-sm"
        />
        <button className="rounded-lg bg-brand-red px-4 py-2 text-sm font-semibold text-white">
          Search
        </button>
        {q && (
          <Link
            href="/admin/orders"
            className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-semibold text-gray-700"
          >
            Clear
          </Link>
        )}
      </form>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Order ID</th>
            <th className="py-2">Parent</th>
            <th className="py-2">Country</th>
            <th className="py-2">Distributor</th>
            <th className="py-2 text-right">Qty</th>
            <th className="py-2 pl-6">Payment</th>
            <th className="py-2">Fulfilment</th>
          </tr>
        </thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.order_number} className="border-b border-gray-100">
              <td className="py-3 font-mono font-medium text-gray-900">{o.order_number}</td>
              <td className="py-3">
                {o.customers ? `${o.customers.first_name} ${o.customers.last_name}` : "—"}
              </td>
              <td className="py-3 text-gray-600">{o.customers?.country ?? "—"}</td>
              <td className="py-3 text-gray-600">{o.distributors?.name ?? "—"}</td>
              <td className="py-3 text-right">{o.quantity}</td>
              <td className="py-3 pl-6">
                <span
                  className={`rounded-full px-2 py-1 text-xs font-semibold ${
                    PAYMENT_BADGE[o.payment_status] ?? "bg-gray-100 text-gray-500"
                  }`}
                >
                  {o.payment_status}
                </span>
              </td>
              <td className="py-3 text-gray-600">{o.fulfilment_status.replace(/_/g, " ")}</td>
            </tr>
          ))}

          {orders.length === 0 && (
            <tr>
              <td colSpan={7} className="py-6 text-center text-gray-400">
                {q ? "No orders match that search." : "No orders yet."}
              </td>
            </tr>
          )}
        </tbody>
      </table>

      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between text-sm">
          {page > 0 ? (
            <Link href={link(page)} className="font-semibold text-brand-red">
              ← Previous
            </Link>
          ) : (
            <span />
          )}
          <span className="text-gray-500">
            Page {page + 1} of {totalPages}
          </span>
          {page + 1 < totalPages ? (
            <Link href={link(page + 2)} className="font-semibold text-brand-red">
              Next →
            </Link>
          ) : (
            <span />
          )}
        </div>
      )}
    </main>
  );
}