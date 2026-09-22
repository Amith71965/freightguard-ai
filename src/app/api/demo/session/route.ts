import { NextResponse } from "next/server";
import { SESSION_COOKIE, ensureSession } from "@/lib/session";
import { listShipments } from "@/services/shipments";

export async function POST() {
  const sessionId = await ensureSession();
  const response = NextResponse.json({ sessionId, shipments: await listShipments(sessionId) });
  response.cookies.set(SESSION_COOKIE, sessionId, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24,
    path: "/",
  });
  return response;
}
