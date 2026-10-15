import { and, count, eq, inArray, ne } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventVillages, events, villages } from "@/lib/schema";
import { eventSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Data kegiatan belum lengkap.");
  const db = getDb();
  const { villageIds, ...eventData } = parsed.data;
  const [existing] = await db.select({ id: events.id }).from(events).where(eq(events.id, id)).limit(1);
  if (!existing) return jsonError("Kegiatan tidak ditemukan.", 404);
  const validVillages = await db.select({ id: villages.id }).from(villages).where(inArray(villages.id, villageIds));
  if (validVillages.length !== villageIds.length) return jsonError("Pilih desa yang tersedia.");
  try {
    const event = await db.transaction(async (tx) => {
      if (eventData.status === "active") await tx.update(events).set({ status: "draft" }).where(and(eq(events.status, "active"), ne(events.id, id)));
      const [updated] = await tx.update(events).set({ ...eventData, description: eventData.description || null }).where(eq(events.id, id)).returning();
      await tx.delete(eventVillages).where(eq(eventVillages.eventId, id));
      await tx.insert(eventVillages).values(villageIds.map((villageId) => ({ eventId: id, villageId })));
      return updated;
    });
    return NextResponse.json({ event });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Kegiatan aktif lain sudah dibuka.", 409);
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const db = getDb();
  const [total] = await db.select({ value: count() }).from(attendances).where(eq(attendances.eventId, id));
  if ((total?.value ?? 0) > 0) return jsonError("Kegiatan sudah memiliki data absensi dan tidak dapat dihapus.", 409);
  const [removed] = await db.delete(events).where(eq(events.id, id)).returning({ id: events.id });
  return removed ? NextResponse.json({ success: true }) : jsonError("Kegiatan tidak ditemukan.", 404);
}
