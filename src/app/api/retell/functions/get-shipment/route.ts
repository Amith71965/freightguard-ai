import { getShipment } from "@/services/shipments";
import { runIdempotentTool } from "@/services/retell-tools";
import { handleRetellTool } from "../_shared";

export async function POST(request: Request) {
  return handleRetellTool(request, "get_shipment", async ({ args, callId, sessionId, shipmentId }) =>
    runIdempotentTool(callId, "get_shipment", args, async () => {
      const shipment = await getShipment(sessionId, shipmentId);
      if (!shipment) return { success: false, error: "Shipment was not found in this demo session." };
      return {
        success: true,
        shipment: {
          tracking_code: shipment.trackingCode,
          carrier: shipment.carrierName,
          route: `${shipment.origin} to ${shipment.destination}`,
          promised_eta: shipment.promisedEta.toISOString(),
          current_eta: shipment.currentEta.toISOString(),
          status: shipment.status,
          exception: shipment.exceptionType,
          allowed_actions: shipment.allowedActions,
        },
      };
    }),
  );
}
