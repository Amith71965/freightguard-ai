import { NextResponse } from "next/server";
import { requireSessionId } from "@/lib/session";
import { listShipments, resetDemoSession } from "@/services/shipments";

export async function POST() {
  try {
    const sessionId = await requireSessionId();
    await resetDemoSession(sessionId);
    return NextResponse.json({ sessionId, shipments: await listShipments(sessionId) });
  } catch {
    return NextResponse.json({ error: "Demo session is not initialized." }, { status: 401 });
  }
}
