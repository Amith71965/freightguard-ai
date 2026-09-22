import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import postgres from "postgres";

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error("DATABASE_URL is required.");

const sql = postgres(databaseUrl, { max: 1 });
const migration = await readFile(resolve("db/migrations/001_initial.sql"), "utf8");

try {
  await sql.unsafe(migration);
  console.log("Applied db/migrations/001_initial.sql");
} finally {
  await sql.end();
}
