import { and, asc, count, desc, eq, gte, inArray, like, lte, or } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jakartaDateBound } from "@/lib/dates";
import { attendances, events, groups, villages } from "@/lib/schema";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const params = request.nextUrl.searchParams;
  const locationFilter = params.get("location");
  const eventValue = params.get("eventId");
  const allEventsSelected = eventValue === "all";
  const eventId = Number(eventValue);
  if (locationFilter === null && !allEventsSelected && (!Number.isInteger(eventId) || eventId < 1)) return NextResponse.json({ attendances: [], total: 0, page: 1, pages: 0 });
  const page = Math.max(1, Number(params.get("page") || 1));
  const pageSize = Math.min(100, Math.max(10, Number(params.get("pageSize") || 10)));
  const sortBy = params.get("sort") || "createdAt";
  const sortDirection = params.get("direction") === "asc" ? "asc" : "desc";
  const q = (params.get("q") || "").trim();
  const from = params.get("from");
  const to = params.get("to");
  const db = getDb();
  const conditions = [];
  if (locationFilter !== null) {
    if (locationFilter !== "all") {
      const matchingEvents = await db.select({ id: events.id }).from(events).where(eq(events.location, locationFilter));
      const matchingEventIds = matchingEvents.map((event) => event.id);
      conditions.push(matchingEventIds.length ? inArray(attendances.eventId, matchingEventIds) : eq(attendances.eventId, -1));
    }
  } else if (!allEventsSelected) conditions.push(eq(attendances.eventId, eventId));
  if (q) conditions.push(or(like(attendances.fullName, `%${q}%`), like(attendances.occupation, `%${q}%`))!);
  if (from) conditions.push(gte(attendances.createdAt, jakartaDateBound(from)));
  if (to) conditions.push(lte(attendances.createdAt, jakartaDateBound(to, true)));
  const where = and(...conditions);
  const [totalRow] = await db.select({ value: count() }).from(attendances).where(where);
  const total = totalRow?.value ?? 0;
  const orderColumn = sortBy === "fullName" ? attendances.fullName : sortBy === "age" ? attendances.age : attendances.createdAt;
  const ordered = sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);
  const rows = await db.select({ id: attendances.id, eventId: attendances.eventId, eventLocation: events.location, fullName: attendances.fullName, age: attendances.age, gender: attendances.gender, occupation: attendances.occupation, createdAt: attendances.createdAt, villageId: attendances.villageId, groupId: attendances.groupId, villageName: villages.name, groupName: groups.name })
    .from(attendances).innerJoin(events, eq(attendances.eventId, events.id)).innerJoin(villages, eq(attendances.villageId, villages.id)).innerJoin(groups, eq(attendances.groupId, groups.id))
    .where(where).orderBy(ordered, asc(attendances.fullName)).limit(pageSize).offset((page - 1) * pageSize);
  return NextResponse.json({ attendances: rows, total, page, pages: Math.ceil(total / pageSize) });
}
