import { NextResponse } from "next/server";
import { requireSessionId } from "@/lib/session";
import { getShipment } from "@/services/shipments";

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const sessionId = await requireSessionId();
    const { id } = await params;
    const shipment = await getShipment(sessionId, id);
    if (!shipment) return NextResponse.json({ error: "Shipment not found." }, { status: 404 });
    return NextResponse.json({ shipment });
  } catch {
    return NextResponse.json({ error: "Demo session is not initialized." }, { status: 401 });
  }
}
