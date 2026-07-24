import { NextRequest, NextResponse } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";

export function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Allow public paths
  if (
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next/") ||
    pathname.startsWith("/favicon.ico") ||
    pathname === "/login"
  ) {
    return NextResponse.next();
  }

  const accessToken = req.cookies.get("access_token")?.value;

  if (accessToken) {
    try {
      verifyAccessToken(accessToken);
      return NextResponse.next();
    } catch {
      // Token expired or invalid — try to refresh below
    }
  }

  // Check if refresh token exists
  const refreshToken = req.cookies.get("refresh_token")?.value;

  if (refreshToken) {
    // API routes should get 401, not redirect
    if (pathname.startsWith("/api/")) {
      return NextResponse.json({ error: "Token expired" }, { status: 401 });
    }
    // Page routes: redirect to refresh endpoint which will issue new token and redirect back
    const refreshUrl = new URL("/api/auth/refresh", req.url);
    refreshUrl.searchParams.set("redirect", pathname + (req.nextUrl.search || ""));
    return NextResponse.redirect(refreshUrl);
  }

  // No tokens at all
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", req.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    "/((?!api/auth|_next/static|_next/image|favicon\\.ico|login).*)",
  ],
};
