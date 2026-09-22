import { NextResponse } from "next/server";
import { sql } from "@/db/client";

export async function GET() {
  try {
    await sql`select 1`;
    return NextResponse.json({ status: "ok", database: "connected" });
  } catch {
    return NextResponse.json({ status: "degraded", database: "unavailable" }, { status: 503 });
  }
}
