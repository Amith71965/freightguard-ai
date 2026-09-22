import {
  index,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";

export const shipmentStatus = pgEnum("shipment_status", [
  "attention",
  "in_transit",
  "rescheduled",
  "escalated",
  "delivered",
]);

export const exceptionType = pgEnum("exception_type", [
  "weather_delay",
  "damage_risk",
  "missed_window",
  "not_found",
]);

export const demoSessions = pgTable("demo_sessions", {
  id: uuid("id").primaryKey(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  resetAt: timestamp("reset_at", { withTimezone: true }).notNull().defaultNow(),
});

export const shipments = pgTable(
  "shipments",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    trackingCode: text("tracking_code").notNull(),
    customerName: text("customer_name").notNull(),
    carrierName: text("carrier_name").notNull(),
    origin: text("origin").notNull(),
    destination: text("destination").notNull(),
    promisedEta: timestamp("promised_eta", { withTimezone: true }).notNull(),
    currentEta: timestamp("current_eta", { withTimezone: true }).notNull(),
    status: shipmentStatus("status").notNull().default("attention"),
    exceptionType: exceptionType("exception_type").notNull(),
    scenarioBehavior: text("scenario_behavior").notNull().default("normal"),
    version: integer("version").notNull().default(1),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    uniqueIndex("shipments_session_tracking_idx").on(table.sessionId, table.trackingCode),
    index("shipments_session_idx").on(table.sessionId),
  ],
);

export const shipmentEvents = pgTable(
  "shipment_events",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    shipmentId: uuid("shipment_id")
      .notNull()
      .references(() => shipments.id, { onDelete: "cascade" }),
    eventType: text("event_type").notNull(),
    source: text("source").notNull(),
    payload: jsonb("payload").notNull().default({}),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("shipment_events_shipment_idx").on(table.shipmentId, table.createdAt)],
);

export const calls = pgTable(
  "calls",
  {
    callId: text("call_id").primaryKey(),
    sessionId: uuid("session_id")
      .notNull()
      .references(() => demoSessions.id, { onDelete: "cascade" }),
    shipmentId: uuid("shipment_id").references(() => shipments.id, { onDelete: "set null" }),
    lifecycleStatus: text("lifecycle_status").notNull().default("started"),
    disposition: text("disposition"),
    transcript: jsonb("transcript"),
    analysis: jsonb("analysis"),
    latency: jsonb("latency"),
    startedAt: timestamp("started_at", { withTimezone: true }),
    endedAt: timestamp("ended_at", { withTimezone: true }),
    analyzedAt: timestamp("analyzed_at", { withTimezone: true }),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("calls_session_idx").on(table.sessionId, table.updatedAt)],
);

export const requestReceipts = pgTable("request_receipts", {
  fingerprint: text("fingerprint").primaryKey(),
  callId: text("call_id").notNull(),
  functionName: text("function_name").notNull(),
  response: jsonb("response"),
  processingStatus: text("processing_status").notNull().default("started"),
  attempts: integer("attempts").notNull().default(1),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const webhookReceipts = pgTable("webhook_receipts", {
  digest: text("digest").primaryKey(),
  eventType: text("event_type").notNull(),
  callId: text("call_id").notNull(),
  receivedAt: timestamp("received_at", { withTimezone: true }).notNull().defaultNow(),
});

export type Shipment = typeof shipments.$inferSelect;
export type ShipmentEvent = typeof shipmentEvents.$inferSelect;
export type CallRecord = typeof calls.$inferSelect;
