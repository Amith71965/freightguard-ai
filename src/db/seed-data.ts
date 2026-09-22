import type { InferInsertModel } from "drizzle-orm";
import type { shipments } from "./schema";

type SeedShipment = Omit<
  InferInsertModel<typeof shipments>,
  "id" | "sessionId" | "promisedEta" | "currentEta" | "createdAt" | "updatedAt"
> & {
  promisedOffsetHours: number;
  currentOffsetHours: number;
};

export const seedShipments: SeedShipment[] = [
  {
    trackingCode: "FG-28471",
    customerName: "Northline Retail",
    carrierName: "Atlas Freight",
    origin: "Columbus, OH",
    destination: "Newark, NJ",
    promisedOffsetHours: 3,
    currentOffsetHours: 8,
    status: "attention",
    exceptionType: "weather_delay",
    scenarioBehavior: "normal",
    version: 1,
  },
  {
    trackingCode: "FG-39204",
    customerName: "Morrow Medical",
    carrierName: "Blue Ridge Logistics",
    origin: "Richmond, VA",
    destination: "Baltimore, MD",
    promisedOffsetHours: 5,
    currentOffsetHours: 5,
    status: "attention",
    exceptionType: "damage_risk",
    scenarioBehavior: "escalation_required",
    version: 1,
  },
  {
    trackingCode: "FG-51788",
    customerName: "Keystone Components",
    carrierName: "Meridian Transport",
    origin: "Pittsburgh, PA",
    destination: "Trenton, NJ",
    promisedOffsetHours: -1,
    currentOffsetHours: 4,
    status: "attention",
    exceptionType: "missed_window",
    scenarioBehavior: "normal",
    version: 1,
  },
  {
    trackingCode: "FG-61033",
    customerName: "Cedar Home Goods",
    carrierName: "Vector Carriers",
    origin: "Harrisburg, PA",
    destination: "Queens, NY",
    promisedOffsetHours: 7,
    currentOffsetHours: 7,
    status: "attention",
    exceptionType: "not_found",
    scenarioBehavior: "transient_failure",
    version: 1,
  },
];

export function materializeSeedShipments(sessionId: string, now = new Date()) {
  return seedShipments.map(({ promisedOffsetHours, currentOffsetHours, ...shipment }) => ({
    ...shipment,
    sessionId,
    promisedEta: new Date(now.getTime() + promisedOffsetHours * 60 * 60 * 1_000),
    currentEta: new Date(now.getTime() + currentOffsetHours * 60 * 60 * 1_000),
  }));
}
