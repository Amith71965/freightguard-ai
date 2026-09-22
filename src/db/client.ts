import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";

const connectionString =
  process.env.DATABASE_URL ??
  "postgres://freightguard:freightguard@127.0.0.1:55432/freightguard";

const globalForDb = globalThis as unknown as {
  freightguardSql?: ReturnType<typeof postgres>;
};

export const sql =
  globalForDb.freightguardSql ??
  postgres(connectionString, {
    max: process.env.NODE_ENV === "production" ? 5 : 10,
    prepare: false,
  });

if (process.env.NODE_ENV !== "production") globalForDb.freightguardSql = sql;

export const db = drizzle(sql);
