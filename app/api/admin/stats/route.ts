import { and, asc, count, eq, gte, inArray, lte, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jakartaDateBound } from "@/lib/dates";
import { attendances, eventVillages, events, groups, villages } from "@/lib/schema";

const ageBands = [
  { label: "≤12", condition: sql`${attendances.age} <= 12` },
  { label: "13–17", condition: sql`${attendances.age} BETWEEN 13 AND 17` },
  { label: "18–25", condition: sql`${attendances.age} BETWEEN 18 AND 25` },
  { label: "26–35", condition: sql`${attendances.age} BETWEEN 26 AND 35` },
  { label: "36–45", condition: sql`${attendances.age} BETWEEN 36 AND 45` },
  { label: "46–60", condition: sql`${attendances.age} BETWEEN 46 AND 60` },
  { label: ">60", condition: sql`${attendances.age} > 60` },
];

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const params = request.nextUrl.searchParams;
  const eventId = Number(params.get("eventId"));
  const locationFilter = params.get("location");
  const allEventsSelected = params.get("eventId") === "all";
  const from = params.get("from");
  const to = params.get("to");
  const db = getDb();
  const allEvents = await db.select({ id: events.id, name: events.name, location: events.location, status: events.status, eventDate: events.eventDate, eventTime: events.eventTime }).from(events).orderBy(asc(events.eventDate));
  const selected = allEventsSelected ? undefined : Number.isInteger(eventId) && eventId > 0 ? eventId : allEvents.find((event) => event.status === "active")?.id ?? allEvents[0]?.id;
  const filteredEventIds = locationFilter !== null
    ? allEvents.filter((event) => locationFilter === "all" || event.location === locationFilter).map((event) => event.id)
    : selected ? [selected] : allEvents.map((event) => event.id);
  const participatingVillages = filteredEventIds.length
    ? await db.selectDistinct({ id: eventVillages.villageId }).from(eventVillages)
      .where(inArray(eventVillages.eventId, filteredEventIds))
    : [];
  const conditions = [];
  if (locationFilter !== null) {
    if (locationFilter !== "all") {
      const matchingEventIds = allEvents.filter((event) => event.location === locationFilter).map((event) => event.id);
      conditions.push(matchingEventIds.length ? inArray(attendances.eventId, matchingEventIds) : eq(attendances.eventId, -1));
    }
  } else if (selected) conditions.push(eq(attendances.eventId, selected));
  if (from) conditions.push(gte(attendances.createdAt, jakartaDateBound(from)));
  if (to) conditions.push(lte(attendances.createdAt, jakartaDateBound(to, true)));
  const where = conditions.length ? and(...conditions) : undefined;
  const [summaryRows, villageCounts, groupCounts, villageData, groupData] = await Promise.all([
    db.select({
      total: count().mapWith(Number),
      male: sql<number>`coalesce(sum(case when ${attendances.gender} = 'male' then 1 else 0 end), 0)`.mapWith(Number),
      female: sql<number>`coalesce(sum(case when ${attendances.gender} = 'female' then 1 else 0 end), 0)`.mapWith(Number),
      activeVillages: sql<number>`count(distinct ${attendances.villageId})`.mapWith(Number),
      activeGroups: sql<number>`count(distinct ${attendances.groupId})`.mapWith(Number),
      averageAge: sql<number>`coalesce(round(avg(${attendances.age})), 0)`.mapWith(Number),
      ...Object.fromEntries(ageBands.map(({ label, condition }, index) => [
        `age${index}`,
        sql<number>`coalesce(sum(case when ${condition} then 1 else 0 end), 0)`.mapWith(Number),
      ])),
    }).from(attendances).where(where),
    db.select({ villageId: attendances.villageId, total: count().mapWith(Number) }).from(attendances).where(where).groupBy(attendances.villageId),
    db.select({ groupId: attendances.groupId, total: count().mapWith(Number) }).from(attendances).where(where).groupBy(attendances.groupId),
    db.select({ id: villages.id, name: villages.name }).from(villages).orderBy(asc(villages.name)),
    db.select({ id: groups.id, name: groups.name, villageId: groups.villageId }).from(groups).orderBy(asc(groups.name)),
  ]);
  const [summary] = summaryRows;
  const selectedEvent = selected ? allEvents.find((event) => event.id === selected) : undefined;
  const villageTotals = new Map(villageCounts.map((row) => [row.villageId, row.total]));
  const groupTotals = new Map(groupCounts.map((row) => [row.groupId, row.total]));
  return NextResponse.json({
    event: selectedEvent ?? null, events: allEvents,
    summary: { total: summary.total, male: summary.male, female: summary.female, activeVillages: summary.activeVillages, totalVillages: participatingVillages.length, activeGroups: summary.activeGroups, averageAge: summary.averageAge },
    villages: villageData.filter((village) => participatingVillages.some((participatingVillage) => participatingVillage.id === village.id))
      .map((village) => ({ ...village, total: villageTotals.get(village.id) ?? 0 })),
    groups: groupData.map((group) => ({ ...group, total: groupTotals.get(group.id) ?? 0 })),
    ages: ageBands.map(({ label }, index) => ({ label, total: summary[`age${index}` as keyof typeof summary] })),
  });
}
