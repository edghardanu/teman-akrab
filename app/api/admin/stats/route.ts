import { and, asc, eq, gte, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jakartaDateBound } from "@/lib/dates";
import { attendances, events, groups, villages } from "@/lib/schema";

const ageBands = ["≤12", "13–17", "18–25", "26–35", "36–45", "46–60", ">60"];
function ageBand(age: number) {
  if (age <= 12) return ageBands[0];
  if (age <= 17) return ageBands[1];
  if (age <= 25) return ageBands[2];
  if (age <= 35) return ageBands[3];
  if (age <= 45) return ageBands[4];
  if (age <= 60) return ageBands[5];
  return ageBands[6];
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const params = request.nextUrl.searchParams;
  const eventId = Number(params.get("eventId"));
  const allEventsSelected = params.get("eventId") === "all";
  const from = params.get("from");
  const to = params.get("to");
  const db = getDb();
  const allEvents = await db.select({ id: events.id, name: events.name, location: events.location, status: events.status, eventDate: events.eventDate }).from(events).orderBy(asc(events.eventDate));
  const selected = allEventsSelected ? undefined : Number.isInteger(eventId) && eventId > 0 ? eventId : allEvents.find((event) => event.status === "active")?.id ?? allEvents[0]?.id;
  const [event] = selected ? await db.select().from(events).where(eq(events.id, selected)).limit(1) : [];
  const conditions = [];
  if (selected) conditions.push(eq(attendances.eventId, selected));
  if (from) conditions.push(gte(attendances.createdAt, jakartaDateBound(from)));
  if (to) conditions.push(lte(attendances.createdAt, jakartaDateBound(to, true)));
  const rows = conditions.length ? await db.select({ id: attendances.id, age: attendances.age, gender: attendances.gender, villageId: attendances.villageId, groupId: attendances.groupId }).from(attendances).where(and(...conditions)) : [];
  const villageData = await db.select({ id: villages.id, name: villages.name }).from(villages).orderBy(asc(villages.name));
  const groupData = await db.select({ id: groups.id, name: groups.name, villageId: groups.villageId }).from(groups).orderBy(asc(groups.name));
  const villageCounts = new Map<number, number>();
  const groupCounts = new Map<number, number>();
  const ages = new Map(ageBands.map((band) => [band, 0]));
  let ageTotal = 0;
  let maleTotal = 0;
  let femaleTotal = 0;
  rows.forEach((row) => {
    villageCounts.set(row.villageId, (villageCounts.get(row.villageId) ?? 0) + 1);
    groupCounts.set(row.groupId, (groupCounts.get(row.groupId) ?? 0) + 1);
    ages.set(ageBand(row.age), (ages.get(ageBand(row.age)) ?? 0) + 1);
    ageTotal += row.age;
    if (row.gender === "male") maleTotal++;
    if (row.gender === "female") femaleTotal++;
  });
  return NextResponse.json({
    event, events: allEvents,
    summary: { total: rows.length, male: maleTotal, female: femaleTotal, activeVillages: new Set(rows.map((row) => row.villageId)).size, activeGroups: new Set(rows.map((row) => row.groupId)).size, averageAge: rows.length ? Math.round(ageTotal / rows.length) : 0 },
    villages: villageData.map((village) => ({ ...village, total: villageCounts.get(village.id) ?? 0 })),
    groups: groupData.map((group) => ({ ...group, total: groupCounts.get(group.id) ?? 0 })),
    ages: ageBands.map((label) => ({ label, total: ages.get(label) ?? 0 })),
  });
}
