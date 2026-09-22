import { createHash } from "node:crypto";
import { verify } from "retell-sdk";
import { z } from "zod";

export const retellToolEnvelopeSchema = z.object({
  name: z.string().min(1),
  args: z.record(z.string(), z.unknown()).default({}),
  call: z.object({
    call_id: z.string().min(1),
    metadata: z.record(z.string(), z.unknown()).optional(),
    retell_llm_dynamic_variables: z.record(z.string(), z.string()).optional(),
  }).passthrough(),
}).passthrough();

export type RetellToolEnvelope = z.infer<typeof retellToolEnvelopeSchema>;

export async function verifyRetellRequest(rawBody: string, signature: string | null) {
  const apiKey = process.env.RETELL_API_KEY;
  if (!apiKey || !signature) return false;
  return verify(rawBody, apiKey, signature);
}

export function canonicalize(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalize).join(",")}]`;
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) => a.localeCompare(b));
    return `{${entries.map(([key, item]) => `${JSON.stringify(key)}:${canonicalize(item)}`).join(",")}}`;
  }
  return JSON.stringify(value);
}

export function toolFingerprint(callId: string, functionName: string, args: unknown) {
  return createHash("sha256").update(`${callId}:${functionName}:${canonicalize(args)}`).digest("hex");
}

export function resolveCallContext(envelope: RetellToolEnvelope) {
  const metadata = envelope.call.metadata ?? {};
  const dynamic = envelope.call.retell_llm_dynamic_variables ?? {};
  const sessionId = typeof metadata.session_id === "string" ? metadata.session_id : dynamic.session_id;
  const shipmentId = typeof metadata.shipment_id === "string" ? metadata.shipment_id : dynamic.shipment_id;
  return { callId: envelope.call.call_id, sessionId, shipmentId };
}
