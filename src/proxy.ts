import { NextResponse, type NextRequest } from "next/server";

const prod = process.env.NODE_ENV === "production";
const STAFF = prod ? "__Host-ss" : "ss";
const ADMIN = prod ? "__Host-sa" : "sa";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  // Defence in depth on top of Server Actions' own origin check: reject cross-origin state-changing requests.
  if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
    const origin = req.headers.get("origin");
    if (origin && new URL(origin).host !== req.headers.get("host")) {
      return new NextResponse("Forbidden", { status: 403 });
    }
  }

  // Cheap pre-check (real authorisation happens server-side in layouts and every action)
  if (pathname.startsWith("/dashboard") && !req.cookies.has(STAFF)) {
    return NextResponse.redirect(new URL("/login", req.url));
  }
  if (pathname.startsWith("/admin") && pathname !== "/admin/login" && !req.cookies.has(ADMIN)) {
    return NextResponse.redirect(new URL("/admin/login", req.url));
  }

  const nonce = btoa(crypto.randomUUID());
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${prod ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    `connect-src 'self'${prod ? "" : " ws: wss:"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(prod ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const headers = new Headers(req.headers);
  headers.set("x-nonce", nonce);
  headers.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers } });
  res.headers.set("Content-Security-Policy", csp);
  if (pathname.startsWith("/dashboard") || pathname.startsWith("/admin") || pathname.includes("/login")) {
    res.headers.set("Cache-Control", "no-store");
  }
  return res;
}

export const config = {
  matcher: [{ source: "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|webp|svg|ico)$).*)" }],
};
