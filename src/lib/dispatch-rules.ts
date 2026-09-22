import { z } from "zod";

export type DispatchShipment = {
  status: "attention" | "in_transit" | "rescheduled" | "escalated" | "delivered";
  exceptionType: "weather_delay" | "damage_risk" | "missed_window" | "not_found";
};

export const rescheduleInput = z.object({
  proposedEta: z.iso.datetime({ offset: true }),
  reason: z.string().trim().min(4).max(280),
});

export const escalationInput = z.object({
  severity: z.enum(["medium", "high", "critical"]),
  reason: z.string().trim().min(4).max(280),
  notes: z.string().trim().max(500).default(""),
});

export function assertCanReschedule(shipment: DispatchShipment, proposedEta: Date) {
  if (shipment.status === "delivered") throw new Error("Delivered shipments cannot be changed.");
  if (shipment.status === "escalated") throw new Error("Escalated shipments require human review.");
  if (shipment.exceptionType === "damage_risk" || shipment.exceptionType === "not_found") {
    throw new Error("This exception must be escalated before rescheduling.");
  }
  if (proposedEta.getTime() <= Date.now()) throw new Error("The revised ETA must be in the future.");
}

export function assertCanEscalate(shipment: DispatchShipment) {
  if (shipment.status === "delivered") throw new Error("Delivered shipments cannot be escalated.");
}

export function allowedActions(shipment: DispatchShipment) {
  if (shipment.status === "delivered") return [];
  if (shipment.exceptionType === "damage_risk" || shipment.exceptionType === "not_found") {
    return ["create_escalation"];
  }
  return ["reschedule_delivery", "create_escalation"];
}
