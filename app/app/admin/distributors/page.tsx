import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

interface DemandRow {
  distributor_id: string;
  name: string;
  city: string | null;
  country: string;
  order_count: number;
  packages_required: number;
}

async function getDistributorDemand(): Promise<DemandRow[]> {
  const supabase = await createClient();

  // Demand = sum of quantities for PAID orders, grouped by selected
  // distributor (PRD §25). Modeled here as a Postgres view for speed;
  // see supabase/002_views.sql for the SQL definition.
  const { data, error } = await supabase.from("distributor_demand").select("*");

  if (error) {
    console.error(error);
    return [];
  }
  return data as DemandRow[];
}

export default async function DistributorDemandPage() {
  const rows = await getDistributorDemand();
  const totalPackages = rows.reduce((sum, r) => sum + r.packages_required, 0);

  return (
    <main className="min-h-screen bg-white p-8">
      <h1 className="text-2xl font-bold text-gray-900">Distribution Overview</h1>
      <p className="mt-1 text-sm text-gray-500">
        Book requirements calculated automatically from paid orders. Click a
        distributor to see and share the names of who's collecting there.
      </p>

      <div className="mt-4 inline-block rounded-lg bg-brand-red-light px-4 py-2 text-sm font-semibold text-brand-red">
        Total packages required across all distributors: {totalPackages.toLocaleString()}
      </div>

      <table className="mt-6 w-full text-left text-sm">
        <thead>
          <tr className="border-b border-gray-200 text-gray-500">
            <th className="py-2">Distributor</th>
            <th className="py-2">Location</th>
            <th className="py-2 text-right">Orders</th>
            <th className="py-2 text-right">Packages Required</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.distributor_id} className="border-b border-gray-100">
              <td className="py-3">
                <Link
                  href={`/admin/distributors/${r.distributor_id}`}
                  className="font-medium text-brand-red hover:underline"
                >
                  {r.name}
                </Link>
              </td>
              <td className="py-3 text-gray-600">
                {[r.city, r.country].filter(Boolean).join(", ")}
              </td>
              <td className="py-3 text-right">{r.order_count}</td>
              <td className="py-3 text-right font-semibold">{r.packages_required}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
