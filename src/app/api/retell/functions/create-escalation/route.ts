import { z } from "zod";
import { escalateShipment, getShipment } from "@/services/shipments";
import { RetryableToolError, runIdempotentTool } from "@/services/retell-tools";
import { handleRetellTool } from "../_shared";

const argsSchema = z.object({
  severity: z.enum(["medium", "high", "critical"]),
  reason: z.string().min(3).max(300),
  notes: z.string().min(3).max(600),
});

export async function POST(request: Request) {
  return handleRetellTool(request, "create_escalation", async ({ args, callId, sessionId, shipmentId }) => {
    const parsed = argsSchema.parse(args);
    return runIdempotentTool(callId, "create_escalation", parsed, async (attempt) => {
      const current = await getShipment(sessionId, shipmentId);
      if (!current) return { success: false, error: "Shipment was not found in this demo session." };
      if (current.scenarioBehavior === "transient_failure" && attempt === 1) {
        throw new RetryableToolError("Temporary exception-desk timeout. Retell may retry safely.");
      }
      const result = await escalateShipment(sessionId, shipmentId, parsed.severity, parsed.reason, parsed.notes);
      return {
        success: true,
        message: "Escalation created.",
        tracking_code: result.shipment.trackingCode,
        status: result.shipment.status,
        ticket_id: result.ticketId,
        owner: result.owner,
        event_id: result.eventId,
      };
    });
  });
}
