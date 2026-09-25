import { createClient } from "@/lib/supabase/server";

interface Overview {
  total_revenue: number;
  total_paid_orders: number;
  total_packages_ordered: number;
  pending_payments: number;
  active_distributors: number;
  awaiting_books: number;
  allocated_to_distributors: number;
  in_transit: number;
  received_by_distributors: number;
  delivered: number;
  exceptions: number;
}

async function getOverview(): Promise<Overview | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.from("academy_overview").select("*").single();
  if (error) {
    console.error(error);
    return null;
  }
  return data as Overview;
}

function formatNaira(n: number) {
  return `₦${n.toLocaleString("en-NG")}`;
}

function Card({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string | number;
  tone?: "default" | "warning" | "danger";
}) {
  const toneClass =
    tone === "warning"
      ? "text-warning"
      : tone === "danger"
      ? "text-danger"
      : "text-gray-900";
  return (
    <div className="rounded-xl border border-gray-100 p-5">
      <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${toneClass}`}>{value}</p>
    </div>
  );
}

export default async function AdminDashboard() {
  const o = await getOverview();

  if (!o) {
    return (
      <main className="p-8">
        <p className="text-sm text-danger">
          Could not load dashboard. Make sure the academy_overview view exists
          (supabase/002_views.sql).
        </p>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
      <p className="mt-1 text-sm text-gray-500">
        The complete operational picture, at a glance.
      </p>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Overview
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card label="Total Revenue" value={formatNaira(o.total_revenue)} />
        <Card label="Total Paid Orders" value={o.total_paid_orders.toLocaleString()} />
        <Card label="Total Packages Ordered" value={o.total_packages_ordered.toLocaleString()} />
        <Card
          label="Pending Payments"
          value={o.pending_payments.toLocaleString()}
          tone={o.pending_payments > 0 ? "warning" : "default"}
        />
        <Card label="Active Distributors" value={o.active_distributors.toLocaleString()} />
        <Card
          label="Exceptions"
          value={o.exceptions.toLocaleString()}
          tone={o.exceptions > 0 ? "danger" : "default"}
        />
      </div>

      <h2 className="mt-8 text-xs font-semibold uppercase tracking-wide text-gray-400">
        Fulfilment Pipeline
      </h2>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
        <Card label="Awaiting Books" value={o.awaiting_books.toLocaleString()} />
        <Card label="Allocated to Distributors" value={o.allocated_to_distributors.toLocaleString()} />
        <Card label="In Transit" value={o.in_transit.toLocaleString()} />
        <Card label="Received by Distributors" value={o.received_by_distributors.toLocaleString()} />
        <Card label="Delivered" value={o.delivered.toLocaleString()} />
      </div>
    </main>
  );
}
