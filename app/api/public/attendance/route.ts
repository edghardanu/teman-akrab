import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isUniqueError, jsonError } from "@/lib/api";
import { attendanceSchema } from "@/lib/validation";
import { attendances, eventVillages, events, groups, villages } from "@/lib/schema";

export async function POST(request: NextRequest) {
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!await consumeRateLimit("attendance", ip, 8, 15 * 60_000)) return jsonError("Terlalu banyak percobaan. Silakan coba lagi beberapa menit lagi.", 429);
  const payload = await request.json().catch(() => null);
  const parsed = attendanceSchema.safeParse(payload);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi.");

  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(eq(events.status, "active")).limit(1);
  if (!event) return jsonError("Pendaftaran untuk kegiatan ini sudah ditutup.", 409);
  const [participatingVillage] = await db.select({ villageId: eventVillages.villageId }).from(eventVillages)
    .where(and(eq(eventVillages.eventId, event.id), eq(eventVillages.villageId, parsed.data.villageId))).limit(1);
  if (!participatingVillage) return jsonError("Desa ini tidak termasuk dalam kegiatan yang sedang dibuka.", 409);
  const [village] = await db.select({ id: villages.id }).from(villages).where(and(eq(villages.id, parsed.data.villageId), eq(villages.isActive, true))).limit(1);
  const [group] = await db.select({ id: groups.id, villageId: groups.villageId }).from(groups).where(and(eq(groups.id, parsed.data.groupId), eq(groups.isActive, true))).limit(1);
  if (!village || !group || group.villageId !== village.id) return jsonError("Desa dan kelompok yang dipilih tidak sesuai.");
  try {
    await db.insert(attendances).values({ ...parsed.data, eventId: event.id });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Anda sudah tercatat hadir.", 409);
    throw error;
  }
  return NextResponse.json({ success: true, message: "Kehadiran berhasil dicatat." }, { status: 201 });
}
