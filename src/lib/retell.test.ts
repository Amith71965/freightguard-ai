import { describe, expect, it } from "vitest";
import { canonicalize, resolveCallContext, toolFingerprint } from "./retell";

describe("Retell request helpers", () => {
  it("creates the same fingerprint for reordered object keys", () => {
    expect(toolFingerprint("call_1", "update", { b: 2, a: 1 })).toBe(
      toolFingerprint("call_1", "update", { a: 1, b: 2 }),
    );
  });

  it("canonicalizes nested values deterministically", () => {
    expect(canonicalize({ z: [{ b: true, a: null }], a: "x" })).toBe('{"a":"x","z":[{"a":null,"b":true}]}');
  });

  it("prefers signed call metadata for tenant context", () => {
    const context = resolveCallContext({
      name: "get_shipment",
      args: {},
      call: {
        call_id: "call_1",
        metadata: { session_id: "session-from-metadata", shipment_id: "shipment-from-metadata" },
        retell_llm_dynamic_variables: { session_id: "untrusted-fallback", shipment_id: "fallback" },
      },
    });
    expect(context).toEqual({ callId: "call_1", sessionId: "session-from-metadata", shipmentId: "shipment-from-metadata" });
  });
});
