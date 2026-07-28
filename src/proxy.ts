import { randomUUID } from "node:crypto";
import { getSessionCookie } from "better-auth/cookies";
import { NextResponse, type NextRequest } from "next/server";
import { isPublicDemo } from "@/lib/config/app-mode";
import { applySecurityHeaders } from "@/lib/security/security-headers";

export function proxy(request: NextRequest) {
  const nonce = Buffer.from(randomUUID()).toString("base64");
  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", securityPolicyValue(nonce));

  let response: NextResponse;
  if (isPublicDemo() && isPrivateSurface(request.nextUrl.pathname)) {
    response = request.nextUrl.pathname.startsWith("/api/")
      ? NextResponse.json({ error: "NOT_FOUND" }, { status: 404 })
      : NextResponse.redirect(new URL("/unavailable", request.url));
  } else if (
    request.nextUrl.pathname.startsWith("/dashboard") &&
    !getSessionCookie(request)
  ) {
    const login = new URL("/login", request.url);
    login.searchParams.set("returnTo", request.nextUrl.pathname);
    response = NextResponse.redirect(login);
  } else {
    response = NextResponse.next({ request: { headers: requestHeaders } });
  }
  applySecurityHeaders(response.headers, {
    nonce,
    production: process.env.NODE_ENV === "production",
    https: process.env.PUBLIC_APP_URL?.startsWith("https://") ?? false,
  });
  return response;
}

function securityPolicyValue(nonce: string): string {
  const headers = new Headers();
  applySecurityHeaders(headers, {
    nonce,
    production: process.env.NODE_ENV === "production",
    https: process.env.PUBLIC_APP_URL?.startsWith("https://") ?? false,
  });
  return headers.get("Content-Security-Policy")!;
}

function isPrivateSurface(pathname: string): boolean {
  return (
    pathname === "/login" ||
    pathname === "/register" ||
    pathname.startsWith("/dashboard") ||
    pathname.startsWith("/api/auth") ||
    pathname.startsWith("/api/export") ||
    pathname.startsWith("/api/github") ||
    pathname.startsWith("/api/outputs") ||
    pathname.startsWith("/profiles/") ||
    pathname.startsWith("/projects/")
  );
}

export const config = {
  matcher: [
    {
      source:
        "/((?!_next/static|_next/image|favicon.ico|icon.svg|.*\\.(?:png|jpg|jpeg|gif|webp|svg)$).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
