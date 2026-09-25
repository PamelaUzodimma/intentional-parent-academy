import { NextResponse, type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

export async function proxy(request: NextRequest) {
  const { response, user, supabase } = await updateSession(request);
  const { pathname } = request.nextUrl;

  if (!pathname.startsWith("/admin")) {
    return response;
  }

  if (!user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  const { data: profile, error } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

    console.log("DEBUG user.id:", user.id);
    console.log("DEBUG profile:", profile);
    console.log("DEBUG error:", error);

  const role = profile?.role;

  // /admin/payments is shared by academy_admin and payment_verifier.
  // Every other /admin route requires full academy_admin.
  const isPaymentsRoute = pathname.startsWith("/admin/payments");
  const allowed = isPaymentsRoute
    ? role === "academy_admin" || role === "payment_verifier"
    : role === "academy_admin";

  if (!allowed) {
    return NextResponse.redirect(new URL("/login?error=not_authorized", request.url));
  }

  return response;
}

export const config = {
  matcher: ["/admin/:path*"],
};
