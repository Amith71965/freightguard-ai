import { z } from "zod";
import { getShipment, rescheduleShipment } from "@/services/shipments";
import { RetryableToolError, runIdempotentTool } from "@/services/retell-tools";
import { handleRetellTool } from "../_shared";

const argsSchema = z.object({ proposed_eta: z.iso.datetime({ offset: true }), reason: z.string().min(3).max(300) });

export async function POST(request: Request) {
  return handleRetellTool(request, "reschedule_delivery", async ({ args, callId, sessionId, shipmentId }) => {
    const parsed = argsSchema.parse(args);
    return runIdempotentTool(callId, "reschedule_delivery", parsed, async (attempt) => {
      const current = await getShipment(sessionId, shipmentId);
      if (!current) return { success: false, error: "Shipment was not found in this demo session." };
      if (current.scenarioBehavior === "transient_failure" && attempt === 1) {
        throw new RetryableToolError("Temporary carrier-system timeout. Retell may retry safely.");
      }
      const result = await rescheduleShipment(sessionId, shipmentId, new Date(parsed.proposed_eta), parsed.reason);
      return {
        success: true,
        message: "Delivery ETA recorded.",
        tracking_code: result.shipment.trackingCode,
        status: result.shipment.status,
        confirmed_eta: result.shipment.currentEta.toISOString(),
        event_id: result.eventId,
      };
    });
  });
}
