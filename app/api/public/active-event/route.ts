import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { events } from "@/lib/schema";

export const runtime = "nodejs";

export async function GET() {
  const activeEvents = await getDb().select({ id: events.id, name: events.name, eventDate: events.eventDate, eventTime: events.eventTime, location: events.location, description: events.description })
    .from(events).where(eq(events.status, "active")).orderBy(asc(events.eventDate), asc(events.id));
  return NextResponse.json({ events: activeEvents });
}
