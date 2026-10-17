import { count, desc, eq, inArray } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventVillages, events, villages } from "@/lib/schema";
import { eventSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const db = getDb();
  const rows = await db.select().from(events).orderBy(desc(events.eventDate), desc(events.id));
  const [counts, selectedVillages] = await Promise.all([
    db.select({ eventId: attendances.eventId, total: count() }).from(attendances).groupBy(attendances.eventId),
    db.select({ eventId: eventVillages.eventId, villageId: eventVillages.villageId }).from(eventVillages),
  ]);
  const countByEvent = new Map(counts.map((row) => [row.eventId, row.total]));
  const villagesByEvent = new Map<number, number[]>();
  for (const selection of selectedVillages) villagesByEvent.set(selection.eventId, [...(villagesByEvent.get(selection.eventId) ?? []), selection.villageId]);
  return NextResponse.json({ events: rows.map((event) => ({ ...event, attendanceCount: countByEvent.get(event.id) ?? 0, villageIds: villagesByEvent.get(event.id) ?? [] })) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Data kegiatan belum lengkap.");
  const db = getDb();
  const { villageIds, ...eventData } = parsed.data;
  const validVillages = await db.select({ id: villages.id }).from(villages).where(inArray(villages.id, villageIds));
  if (validVillages.length !== villageIds.length) return jsonError("Pilih desa yang tersedia.");
  const event = await db.transaction(async (tx) => {
    const [created] = await tx.insert(events).values({ ...eventData, description: eventData.description || null }).returning();
    await tx.insert(eventVillages).values(villageIds.map((villageId) => ({ eventId: created.id, villageId })));
    return created;
  });
  return NextResponse.json({ event }, { status: 201 });
}
