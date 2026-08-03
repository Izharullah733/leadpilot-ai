import { NextResponse, type NextRequest } from "next/server";
import {
  getSafeInternalRedirect,
  isProtectedPath,
} from "@/lib/auth";
import {
  copyResponseCookies,
  refreshSupabaseSession,
} from "@/lib/supabase/middleware";

export async function middleware(request: NextRequest) {
  const { pathname, search } = request.nextUrl;
  const { response, user } = await refreshSupabaseSession(request);

  if (isProtectedPath(pathname) && !user) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    const redirect = NextResponse.redirect(loginUrl);
    redirect.headers.set("Cache-Control", "private, no-store");
    return copyResponseCookies(response, redirect);
  }

  if ((pathname === "/" || pathname === "/login" || pathname === "/signup") && user) {
    const requestedPath = request.nextUrl.searchParams.get("next");
    const destination = getSafeInternalRedirect(requestedPath);
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL(destination, request.url)),
    );
  }

  if (pathname === "/") {
    return copyResponseCookies(
      response,
      NextResponse.redirect(new URL("/login", request.url)),
    );
  }

  if (isProtectedPath(pathname)) {
    response.headers.set(
      "Cache-Control",
      "private, no-store, no-cache, must-revalidate",
    );
  }

  return response;
}

export const config = {
  matcher: [
    "/",
    "/login",
    "/signup",
    "/invitations/:path*",
    "/dashboard/:path*",
    "/leads/:path*",
    "/follow-ups/:path*",
    "/appointments/:path*",
    "/reports/:path*",
    "/team/:path*",
    "/settings/:path*",
    "/account-access",
  ],
};
