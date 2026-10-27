import { NextResponse, type NextRequest } from "next/server";
import { userFromToken } from "@/lib/auth";

const COOKIE = "clintrack_session";

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  if (pathname.startsWith("/api/auth") || pathname === "/icon.svg" || pathname === "/manifest.webmanifest" || pathname === "/sw.js") {
    return NextResponse.next();
  }
  const user = userFromToken(request.cookies.get(COOKIE)?.value);
  if (pathname.startsWith("/api/")) {
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    return NextResponse.next();
  }
  if (pathname === "/login") {
    if (user) return NextResponse.redirect(new URL("/", request.url));
    return NextResponse.next();
  }
  if (!user) return NextResponse.redirect(new URL("/login", request.url));
  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|icon.svg|manifest.webmanifest|sw.js).*)"],
};
