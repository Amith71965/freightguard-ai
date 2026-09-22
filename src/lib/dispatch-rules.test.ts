import { describe, expect, it, vi } from "vitest";
import { allowedActions, assertCanEscalate, assertCanReschedule } from "./dispatch-rules";

describe("dispatch rules", () => {
  it("allows a delayed shipment to be rescheduled", () => {
    vi.setSystemTime(new Date("2026-09-22T12:00:00Z"));
    expect(() =>
      assertCanReschedule(
        { status: "attention", exceptionType: "weather_delay" },
        new Date("2026-09-22T18:00:00Z"),
      ),
    ).not.toThrow();
    vi.useRealTimers();
  });

  it("requires damage and missing-load exceptions to escalate", () => {
    expect(allowedActions({ status: "attention", exceptionType: "damage_risk" })).toEqual([
      "create_escalation",
    ]);
    expect(() =>
      assertCanReschedule(
        { status: "attention", exceptionType: "not_found" },
        new Date(Date.now() + 60_000),
      ),
    ).toThrow("must be escalated");
  });

  it("does not mutate delivered shipments", () => {
    expect(() => assertCanEscalate({ status: "delivered", exceptionType: "weather_delay" })).toThrow(
      "Delivered shipments",
    );
  });

  it("rejects an ETA in the past", () => {
    expect(() =>
      assertCanReschedule(
        { status: "attention", exceptionType: "missed_window" },
        new Date(Date.now() - 1_000),
      ),
    ).toThrow("must be in the future");
  });
});
