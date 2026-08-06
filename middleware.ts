import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { AUTH_COOKIE, sessionToken } from "@/lib/auth";

const PUBLIC_PATHS = ["/gate", "/api/auth"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const isPublic = PUBLIC_PATHS.includes(pathname);
  const expected = process.env.APP_PASSWORD ? await sessionToken(process.env.APP_PASSWORD) : null;
  const authed = expected !== null && req.cookies.get(AUTH_COOKIE)?.value === expected;

  if (!isPublic && !authed) {
    const url = req.nextUrl.clone();
    url.pathname = "/gate";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}

export const config = {
  // Skip Next internals and static assets.
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
