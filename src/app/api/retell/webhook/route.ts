import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/db/client";
import { calls, shipmentEvents, shipments, webhookReceipts } from "@/db/schema";
import { verifyRetellRequest } from "@/lib/retell";

const webhookSchema = z.object({
  event: z.enum(["call_started", "call_ended", "call_analyzed"]),
  call: z.object({
    call_id: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    retell_llm_dynamic_variables: z.record(z.string(), z.string()).optional(),
    start_timestamp: z.number().optional(),
    end_timestamp: z.number().optional(),
    transcript_object: z.unknown().optional(),
    transcript: z.string().optional(),
    call_analysis: z.record(z.string(), z.unknown()).optional(),
    latency: z.unknown().optional(),
  }).passthrough(),
}).passthrough();

function timestamp(value?: number) {
  return value ? new Date(value) : null;
}

export async function POST(request: Request) {
  const rawBody = await request.text();
  if (!(await verifyRetellRequest(rawBody, request.headers.get("x-retell-signature")))) {
    return NextResponse.json({ error: "Invalid Retell signature." }, { status: 401 });
  }

  let webhook: z.infer<typeof webhookSchema>;
  try {
    webhook = webhookSchema.parse(JSON.parse(rawBody));
  } catch {
    return NextResponse.json({ error: "Invalid webhook payload." }, { status: 400 });
  }

  const digest = createHash("sha256").update(rawBody).digest("hex");
  const claimed = await db
    .insert(webhookReceipts)
    .values({ digest, eventType: webhook.event, callId: webhook.call.call_id })
    .onConflictDoNothing()
    .returning();
  if (claimed.length === 0) return NextResponse.json({ received: true, duplicate: true });

  const metadata = webhook.call.metadata ?? {};
  const dynamic = webhook.call.retell_llm_dynamic_variables ?? {};
  const sessionId = typeof metadata.session_id === "string" ? metadata.session_id : dynamic.session_id;
  const shipmentId = typeof metadata.shipment_id === "string" ? metadata.shipment_id : dynamic.shipment_id;
  if (!sessionId || !shipmentId) return NextResponse.json({ received: true, ignored: "missing_demo_context" });

  const [shipment] = await db
    .select({ id: shipments.id })
    .from(shipments)
    .where(and(eq(shipments.id, shipmentId), eq(shipments.sessionId, sessionId)))
    .limit(1);
  if (!shipment) return NextResponse.json({ received: true, ignored: "unknown_shipment" });

  const analysis = webhook.call.call_analysis ?? null;
  const customAnalysis = analysis?.custom_analysis_data;
  const disposition = customAnalysis && typeof customAnalysis === "object" && "disposition" in customAnalysis
    ? String((customAnalysis as Record<string, unknown>).disposition)
    : null;
  const transcript = webhook.call.transcript_object ?? webhook.call.transcript ?? null;
  const lifecycleStatus = webhook.event.replace("call_", "");
  const values = {
    callId: webhook.call.call_id,
    sessionId,
    shipmentId,
    lifecycleStatus,
    disposition,
    transcript,
    analysis,
    latency: webhook.call.latency ?? null,
    startedAt: timestamp(webhook.call.start_timestamp),
    endedAt: timestamp(webhook.call.end_timestamp),
    analyzedAt: webhook.event === "call_analyzed" ? new Date() : null,
    updatedAt: new Date(),
  };

  await db.insert(calls).values(values).onConflictDoUpdate({
    target: calls.callId,
    set: {
      lifecycleStatus: values.lifecycleStatus,
      disposition: values.disposition,
      transcript: values.transcript,
      analysis: values.analysis,
      latency: values.latency,
      startedAt: values.startedAt,
      endedAt: values.endedAt,
      analyzedAt: values.analyzedAt,
      updatedAt: values.updatedAt,
    },
  });

  if (webhook.event === "call_analyzed") {
    await db.insert(shipmentEvents).values({
      shipmentId,
      eventType: "call_analyzed",
      source: "retell_webhook",
      payload: { callId: webhook.call.call_id, disposition, summary: customAnalysis },
    });
  }

  return NextResponse.json({ received: true });
}
