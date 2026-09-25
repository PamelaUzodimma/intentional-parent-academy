import AdminNav from "../components/AdminNav";
import { createClient } from "@/lib/supabase/server";

const FULL_NAV = [
  { href: "/admin", label: "Dashboard" },
  { href: "/admin/orders", label: "Orders" },
  { href: "/admin/payments", label: "Payments" },
  { href: "/admin/distributors", label: "Distributors" },
  { href: "/admin/team", label: "Team Access" },
];

const VERIFIER_NAV = [{ href: "/admin/payments", label: "Payments" }];

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let role: string | undefined;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    role = profile?.role;
  }

  const nav = role === "payment_verifier" ? VERIFIER_NAV : FULL_NAV;

  return (
    <div className="flex min-h-screen">
      <aside className="w-56 shrink-0 border-r border-gray-100 bg-white px-4 py-6">
        <p className="px-2 text-xs font-semibold uppercase tracking-wide text-brand-red">
          IPA Academy
        </p>
        {role === "payment_verifier" && (
          <p className="px-2 text-[11px] text-gray-400">Payment Verifier</p>
        )}
        <div className="mt-6">
          <AdminNav links={nav} />
        </div>
        <form action="/api/auth/signout" method="POST" className="mt-8 px-2">
          <button
            type="submit"
            className="text-sm font-medium text-gray-400 hover:text-brand-red"
          >
            Sign out
          </button>
        </form>
      </aside>
      <div className="flex-1">{children}</div>
    </div>
  );
}
