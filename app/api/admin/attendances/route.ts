import { and, asc, count, desc, eq, gte, inArray, lte, or, sql } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jakartaDateBound } from "@/lib/dates";
import { attendances, eventVillages, events, groups, villages } from "@/lib/schema";
import { normalizePersonName } from "@/lib/name-normalization";
import { z } from "zod";

const adminCreateAttendanceSchema = z.object({
  eventId: z.coerce.number().int().positive(),
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter.").max(100, "Nama maksimal 100 karakter."),
  villageId: z.coerce.number().int().positive("Pilih desa terlebih dahulu."),
  groupId: z.coerce.number().int().positive("Pilih kelompok terlebih dahulu."),
  occupation: z.string().trim().min(1, "Pekerjaan wajib diisi.").max(100, "Pekerjaan maksimal 100 karakter."),
  additionalNotes: z.string().trim().max(1000, "Keterangan tambahan maksimal 1000 karakter.").optional().default(""),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Rentang tanggal tidak valid."),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Rentang tanggal tidak valid."),
  location: z.string().min(1),
});

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
  if (q.length > 100) return jsonError("Pencarian maksimal 100 karakter.");
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
  if (q) {
    const searchableColumns = [attendances.fullName, attendances.occupation, villages.name, groups.name, events.name, events.location];
    const terms = q.split(/\s+/).filter(Boolean).slice(0, 10);
    conditions.push(and(...terms.map((term) => or(...searchableColumns.map(
      (column) => sql`instr(lower(${column}), lower(${term})) > 0`,
    ))!))!);
  }
  if (from) conditions.push(gte(attendances.createdAt, jakartaDateBound(from)));
  if (to) conditions.push(lte(attendances.createdAt, jakartaDateBound(to, true)));
  const where = and(...conditions);
  const [totalRow] = await db.select({ value: count() }).from(attendances)
    .innerJoin(events, eq(attendances.eventId, events.id))
    .innerJoin(villages, eq(attendances.villageId, villages.id))
    .innerJoin(groups, eq(attendances.groupId, groups.id))
    .where(where);
  const total = totalRow?.value ?? 0;
  const orderColumn = sortBy === "fullName" ? attendances.fullName : sortBy === "age" ? attendances.age : attendances.createdAt;
  const ordered = sortDirection === "asc" ? asc(orderColumn) : desc(orderColumn);
  const rows = await db.select({ id: attendances.id, eventId: attendances.eventId, eventLocation: events.location, fullName: attendances.fullName, age: attendances.age, gender: attendances.gender, occupation: attendances.occupation, additionalNotes: attendances.additionalNotes, createdAt: attendances.createdAt, villageId: attendances.villageId, groupId: attendances.groupId, villageName: villages.name, groupName: groups.name })
    .from(attendances).innerJoin(events, eq(attendances.eventId, events.id)).innerJoin(villages, eq(attendances.villageId, villages.id)).innerJoin(groups, eq(attendances.groupId, groups.id))
    .where(where).orderBy(ordered, asc(attendances.fullName)).limit(pageSize).offset((page - 1) * pageSize);
  return NextResponse.json({ attendances: rows, total, page, pages: Math.ceil(total / pageSize) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);

  const parsed = adminCreateAttendanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa kembali data peserta.");
  const { from, to, location, ...form } = parsed.data;
  if (from > to) return jsonError("Tanggal awal tidak boleh melewati tanggal akhir.");

  const db = getDb();
  const [event] = await db.select({
    id: events.id,
    eventDate: events.eventDate,
    eventTime: events.eventTime,
    location: events.location,
  }).from(events).where(eq(events.id, form.eventId)).limit(1);
  if (!event || event.eventDate < from || event.eventDate > to || (location !== "all" && event.location !== location)) {
    return jsonError("Kegiatan tidak sesuai dengan filter tanggal dan tempat yang dipilih.");
  }

  const [participatingVillage] = await db.select({ villageId: eventVillages.villageId }).from(eventVillages)
    .where(and(eq(eventVillages.eventId, event.id), eq(eventVillages.villageId, form.villageId))).limit(1);
  const [village] = await db.select({ id: villages.id }).from(villages).where(eq(villages.id, form.villageId)).limit(1);
  const [group] = await db.select({ id: groups.id, villageId: groups.villageId }).from(groups).where(eq(groups.id, form.groupId)).limit(1);
  if (!participatingVillage || !village || !group || group.villageId !== village.id) {
    return jsonError("Desa dan kelompok yang dipilih tidak sesuai dengan kegiatan.");
  }

  try {
    const createdAt = new Date(`${event.eventDate}T${event.eventTime}:00+07:00`).toISOString().replace("T", " ").slice(0, 19);
    const [attendance] = await db.insert(attendances).values({
      ...form,
      age: null,
      gender: "unknown",
      additionalNotes: form.additionalNotes || null,
      normalizedFullName: normalizePersonName(form.fullName),
      createdAt,
    }).returning({ id: attendances.id });
    return NextResponse.json({ success: true, id: attendance.id }, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Peserta dengan nama, desa, kelompok, dan kegiatan tersebut sudah tercatat.", 409);
    throw error;
  }
}
