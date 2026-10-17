import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventVillages, events, villages } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const eventId = Number(request.nextUrl.searchParams.get("eventId"));
  if (!Number.isInteger(eventId) || eventId < 1) return NextResponse.json({ villages: [] });
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, eventId), eq(events.status, "active"))).limit(1);
  if (!event) return NextResponse.json({ villages: [] });
  const data = await db.select({ id: villages.id, name: villages.name }).from(eventVillages)
    .innerJoin(villages, eq(eventVillages.villageId, villages.id))
    .where(and(eq(eventVillages.eventId, event.id), eq(villages.isActive, true))).orderBy(asc(villages.name));
  return NextResponse.json({ villages: data });
}
