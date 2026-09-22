import { and, eq, sql } from "drizzle-orm";
import { db } from "@/db/client";
import { requestReceipts } from "@/db/schema";
import { toolFingerprint } from "@/lib/retell";

type ToolResult = Record<string, unknown>;

export class RetryableToolError extends Error {}

export async function runIdempotentTool(
  callId: string,
  functionName: string,
  args: unknown,
  operation: (attempt: number) => Promise<ToolResult>,
) {
  const fingerprint = toolFingerprint(callId, functionName, args);
  const inserted = await db
    .insert(requestReceipts)
    .values({ fingerprint, callId, functionName })
    .onConflictDoNothing()
    .returning();

  let attempt = 1;
  if (inserted.length === 0) {
    const [receipt] = await db.select().from(requestReceipts).where(eq(requestReceipts.fingerprint, fingerprint));
    if (receipt?.processingStatus === "completed" && receipt.response) return receipt.response as ToolResult;
    if (receipt?.processingStatus === "started") throw new RetryableToolError("This action is already processing.");
    const [claimed] = await db
      .update(requestReceipts)
      .set({ processingStatus: "started", attempts: sql`${requestReceipts.attempts} + 1`, updatedAt: new Date() })
      .where(and(eq(requestReceipts.fingerprint, fingerprint), eq(requestReceipts.processingStatus, "failed")))
      .returning();
    if (!claimed) throw new RetryableToolError("This action could not be claimed for retry.");
    attempt = claimed.attempts;
  }

  try {
    const response = await operation(attempt);
    await db
      .update(requestReceipts)
      .set({ processingStatus: "completed", response, updatedAt: new Date() })
      .where(eq(requestReceipts.fingerprint, fingerprint));
    return response;
  } catch (error) {
    await db
      .update(requestReceipts)
      .set({ processingStatus: "failed", response: { error: error instanceof Error ? error.message : "Tool failed." }, updatedAt: new Date() })
      .where(eq(requestReceipts.fingerprint, fingerprint));
    throw error;
  }
}
