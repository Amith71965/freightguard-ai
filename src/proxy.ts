import { NextRequest, NextResponse } from "next/server";

export function proxy(request: NextRequest) {
  const allowedHosts = (process.env.ALLOWED_HOSTS ?? "")
    .split(",")
    .map((host) => host.trim().toLowerCase())
    .filter(Boolean);

  if (process.env.NODE_ENV === "production" && allowedHosts.length > 0) {
    const host = (request.headers.get("x-forwarded-host") ?? request.headers.get("host") ?? "").split(":")[0].toLowerCase();
    if (!allowedHosts.includes(host)) return new NextResponse("Unknown host", { status: 403 });
  }
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"] };
