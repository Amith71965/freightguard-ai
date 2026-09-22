import { cookies } from "next/headers";
import { createDemoSession } from "@/services/shipments";

export const SESSION_COOKIE = "freightguard_session";

export async function getSessionId() {
  return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function requireSessionId() {
  const sessionId = await getSessionId();
  if (!sessionId) throw new Error("Demo session is not initialized.");
  return sessionId;
}

export async function ensureSession() {
  const sessionId = await getSessionId();
  return createDemoSession(sessionId ?? undefined);
}
