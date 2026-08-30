import { NextResponse, type NextRequest } from "next/server";
import { ADMIN_COOKIE, isAdminToken } from "@/lib/admin/auth";

/**
 * Gates every admin path. `/admin?token=<ADMIN_TOKEN>` sets the cookie and
 * redirects to the clean URL, so the token does not stay in the address
 * bar. Any other request without a valid cookie gets a 404. The rest of
 * the app does not pass through here.
 */
export function proxy(request: NextRequest) {
  const token = request.nextUrl.searchParams.get("token");
  if (token !== null && isAdminToken(token)) {
    const clean = request.nextUrl.clone();
    clean.searchParams.delete("token");
    const response = NextResponse.redirect(clean);
    response.cookies.set(ADMIN_COOKIE, token, {
      httpOnly: true,
      sameSite: "lax",
      secure: request.nextUrl.protocol === "https:",
      path: "/",
      maxAge: 60 * 60 * 8,
    });
    return response;
  }

  if (isAdminToken(request.cookies.get(ADMIN_COOKIE)?.value)) {
    return NextResponse.next();
  }
  return new NextResponse(null, { status: 404 });
}

export const config = {
  matcher: ["/admin/:path*", "/admin", "/api/admin/:path*"],
};
