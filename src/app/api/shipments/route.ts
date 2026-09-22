import { NextResponse } from "next/server";
import { requireSessionId } from "@/lib/session";
import { listShipments } from "@/services/shipments";

export async function GET() {
  try {
    const sessionId = await requireSessionId();
    return NextResponse.json({ shipments: await listShipments(sessionId) });
  } catch {
    return NextResponse.json({ error: "Demo session is not initialized." }, { status: 401 });
  }
}
