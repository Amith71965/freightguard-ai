import { randomUUID } from "node:crypto";
import { and, asc, desc, eq } from "drizzle-orm";
import { db } from "@/db/client";
import { materializeSeedShipments } from "@/db/seed-data";
import { calls, demoSessions, shipmentEvents, shipments } from "@/db/schema";
import {
  allowedActions,
  assertCanEscalate,
  assertCanReschedule,
} from "@/lib/dispatch-rules";

export async function createDemoSession(sessionId = randomUUID()) {
  await db.transaction(async (tx) => {
    await tx.insert(demoSessions).values({ id: sessionId }).onConflictDoNothing();
    await tx.insert(shipments).values(materializeSeedShipments(sessionId)).onConflictDoNothing();
  });
  return sessionId;
}

export async function resetDemoSession(sessionId: string) {
  await db.transaction(async (tx) => {
    await tx.delete(demoSessions).where(eq(demoSessions.id, sessionId));
    await tx.insert(demoSessions).values({ id: sessionId });
    await tx.insert(shipments).values(materializeSeedShipments(sessionId));
  });
}

export async function listShipments(sessionId: string) {
  return db.select().from(shipments).where(eq(shipments.sessionId, sessionId)).orderBy(asc(shipments.trackingCode));
}

export async function getShipment(sessionId: string, shipmentId: string) {
  const [shipment] = await db
    .select()
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), eq(shipments.sessionId, sessionId)))
    .limit(1);
  if (!shipment) return null;

  const [events, relatedCalls] = await Promise.all([
    db
      .select()
      .from(shipmentEvents)
      .where(eq(shipmentEvents.shipmentId, shipmentId))
      .orderBy(desc(shipmentEvents.createdAt)),
    db.select().from(calls).where(eq(calls.shipmentId, shipmentId)).orderBy(desc(calls.updatedAt)),
  ]);

  return { ...shipment, events, calls: relatedCalls, allowedActions: allowedActions(shipment) };
}

export async function rescheduleShipment(
  sessionId: string,
  shipmentId: string,
  proposedEta: Date,
  reason: string,
) {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, shipmentId), eq(shipments.sessionId, sessionId)))
      .for("update")
      .limit(1);
    if (!shipment) throw new Error("Shipment not found.");
    assertCanReschedule(shipment, proposedEta);

    const [updated] = await tx
      .update(shipments)
      .set({
        currentEta: proposedEta,
        status: "rescheduled",
        version: shipment.version + 1,
        updatedAt: new Date(),
      })
      .where(eq(shipments.id, shipment.id))
      .returning();
    const [event] = await tx
      .insert(shipmentEvents)
      .values({
        shipmentId: shipment.id,
        eventType: "delivery_rescheduled",
        source: "retell_agent",
        payload: { proposedEta: proposedEta.toISOString(), reason },
      })
      .returning();
    return { shipment: updated, eventId: event.id };
  });
}

export async function escalateShipment(
  sessionId: string,
  shipmentId: string,
  severity: "medium" | "high" | "critical",
  reason: string,
  notes: string,
) {
  return db.transaction(async (tx) => {
    const [shipment] = await tx
      .select()
      .from(shipments)
      .where(and(eq(shipments.id, shipmentId), eq(shipments.sessionId, sessionId)))
      .for("update")
      .limit(1);
    if (!shipment) throw new Error("Shipment not found.");
    assertCanEscalate(shipment);

    const ticketId = `ESC-${shipment.trackingCode.slice(3)}-${shipment.version + 1}`;
    const [updated] = await tx
      .update(shipments)
      .set({ status: "escalated", version: shipment.version + 1, updatedAt: new Date() })
      .where(eq(shipments.id, shipment.id))
      .returning();
    const [event] = await tx
      .insert(shipmentEvents)
      .values({
        shipmentId: shipment.id,
        eventType: "escalation_created",
        source: "retell_agent",
        payload: { ticketId, severity, reason, notes, owner: "Exception desk" },
      })
      .returning();
    return { shipment: updated, eventId: event.id, ticketId, owner: "Exception desk" };
  });
}
