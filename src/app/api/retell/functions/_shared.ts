import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { resolveCallContext, retellToolEnvelopeSchema, verifyRetellRequest } from "@/lib/retell";
import { RetryableToolError } from "@/services/retell-tools";

export async function handleRetellTool(
  request: Request,
  expectedName: string,
  handler: (input: { args: Record<string, unknown>; callId: string; sessionId: string; shipmentId: string }) => Promise<Record<string, unknown>>,
) {
  const rawBody = await request.text();
  if (!(await verifyRetellRequest(rawBody, request.headers.get("x-retell-signature")))) {
    return NextResponse.json({ error: "Invalid Retell signature." }, { status: 401 });
  }

  try {
    const envelope = retellToolEnvelopeSchema.parse(JSON.parse(rawBody));
    if (envelope.name !== expectedName) return NextResponse.json({ error: "Function name mismatch." }, { status: 400 });
    const context = resolveCallContext(envelope);
    if (!context.sessionId || !context.shipmentId) {
      return NextResponse.json({ error: "Call is missing its isolated demo context." }, { status: 400 });
    }
    return NextResponse.json(await handler({ args: envelope.args, ...context }));
  } catch (error) {
    if (error instanceof RetryableToolError) return NextResponse.json({ error: error.message }, { status: 503 });
    if (error instanceof ZodError || error instanceof SyntaxError) {
      return NextResponse.json({ error: "Invalid tool request." }, { status: 400 });
    }
    return NextResponse.json({ success: false, error: error instanceof Error ? error.message : "Action failed." });
  }
}
