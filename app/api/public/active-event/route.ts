import { eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { events } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET() {
  const [event] = await getDb().select({ id: events.id, name: events.name, eventDate: events.eventDate, eventTime: events.eventTime, location: events.location, description: events.description })
    .from(events).where(eq(events.status, "active")).limit(1);
  return NextResponse.json({ event: event ?? null });
}
