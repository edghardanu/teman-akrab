import { and, asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventVillages, events, villages } from "@/lib/schema";

export async function GET() {
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.status, "active")).limit(1);
  if (!event) return NextResponse.json({ villages: [] });
  const data = await db.select({ id: villages.id, name: villages.name }).from(eventVillages)
    .innerJoin(villages, eq(eventVillages.villageId, villages.id))
    .where(and(eq(eventVillages.eventId, event.id), eq(villages.isActive, true))).orderBy(asc(villages.name));
  return NextResponse.json({ villages: data });
}
