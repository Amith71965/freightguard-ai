import { randomUUID } from "node:crypto";
import { createDemoSession } from "../src/services/shipments";
import { sql } from "../src/db/client";

const sessionId = randomUUID();

try {
  await createDemoSession(sessionId);
  console.log(`Seeded demo session ${sessionId}`);
} finally {
  await sql.end();
}
