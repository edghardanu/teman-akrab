import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { eventVillages, events, groups, villages } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const villageId = Number(request.nextUrl.searchParams.get("villageId"));
  if (!Number.isInteger(villageId) || villageId < 1) return NextResponse.json({ groups: [] });
  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.status, "active")).limit(1);
  if (!event) return NextResponse.json({ groups: [] });
  const data = await db.select({ id: groups.id, name: groups.name }).from(groups)
    .innerJoin(villages, eq(groups.villageId, villages.id)).innerJoin(eventVillages, eq(eventVillages.villageId, villages.id))
    .where(and(eq(groups.villageId, villageId), eq(groups.isActive, true), eq(villages.isActive, true), eq(eventVillages.eventId, event.id)))
    .orderBy(asc(groups.name));
  return NextResponse.json({ groups: data });
}
