import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { csvCell, jsonError } from "@/lib/api";
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
  if (locationFilter === null && !allEventsSelected && (!Number.isInteger(eventId) || eventId < 1)) return jsonError("Pilih kegiatan terlebih dahulu.");
  const db = getDb();
  const conditions = [];
  if (locationFilter !== null) {
    if (locationFilter !== "all") {
      const matchingEvents = await db.select({ id: events.id }).from(events).where(eq(events.location, locationFilter));
      const matchingEventIds = matchingEvents.map((event) => event.id);
      conditions.push(matchingEventIds.length ? inArray(attendances.eventId, matchingEventIds) : eq(attendances.eventId, -1));
    }
  } else if (!allEventsSelected) conditions.push(eq(attendances.eventId, eventId));
  if (params.get("from")) conditions.push(gte(attendances.createdAt, jakartaDateBound(params.get("from")!)));
  if (params.get("to")) conditions.push(lte(attendances.createdAt, jakartaDateBound(params.get("to")!, true)));
  const rows = await db.select({ eventLocation: events.location, fullName: attendances.fullName, villageName: villages.name, groupName: groups.name, age: attendances.age, gender: attendances.gender, occupation: attendances.occupation, createdAt: attendances.createdAt })
    .from(attendances).innerJoin(events, eq(attendances.eventId, events.id)).innerJoin(villages, eq(attendances.villageId, villages.id)).innerJoin(groups, eq(attendances.groupId, groups.id)).where(conditions.length ? and(...conditions) : undefined).orderBy(asc(events.eventDate), asc(villages.name), asc(attendances.fullName));
  const header = ["Tempat kegiatan", "Nama", "Desa", "Kelompok", "Umur", "Jenis kelamin", "Pekerjaan", "Waktu absen"].map(csvCell).join(",");
  const body = rows.map((row) => [row.eventLocation, row.fullName, row.villageName, row.groupName, row.age, row.gender === "male" ? "Laki-laki" : row.gender === "female" ? "Perempuan" : "Belum diketahui", row.occupation, row.createdAt].map(csvCell).join(","));
  const filename = locationFilter && locationFilter !== "all" ? "absensi-tempat-terpilih.csv" : allEventsSelected || locationFilter === "all" ? "absensi-semua-kegiatan.csv" : `absensi-kegiatan-${eventId}.csv`;
  return new NextResponse(`\ufeff${[header, ...body].join("\r\n")}`, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="${filename}"` } });
}
