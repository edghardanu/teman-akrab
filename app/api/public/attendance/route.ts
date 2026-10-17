import { and, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { consumeRateLimit } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { isUniqueError, jsonError } from "@/lib/api";
import { attendanceSchema } from "@/lib/validation";
import { attendances, eventVillages, events, groups, villages } from "@/lib/schema";
import { normalizePersonName } from "@/lib/name-normalization";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = attendanceSchema.safeParse(payload);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa kembali data yang diisi.");
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  if (!await consumeRateLimit("attendance", ip, 300, 15 * 60_000)) return jsonError("Batas pendaftaran dari jaringan ini tercapai. Silakan hubungi panitia.", 429);

  const db = getDb();
  const [event] = await db.select({ id: events.id }).from(events).where(and(eq(events.id, parsed.data.eventId), eq(events.status, "active"))).limit(1);
  if (!event) return jsonError("Pendaftaran untuk kegiatan ini sudah ditutup.", 409);
  const [participatingVillage] = await db.select({ villageId: eventVillages.villageId }).from(eventVillages)
    .where(and(eq(eventVillages.eventId, event.id), eq(eventVillages.villageId, parsed.data.villageId))).limit(1);
  if (!participatingVillage) return jsonError("Desa ini tidak termasuk dalam kegiatan yang sedang dibuka.", 409);
  const [village] = await db.select({ id: villages.id }).from(villages).where(and(eq(villages.id, parsed.data.villageId), eq(villages.isActive, true))).limit(1);
  const [group] = await db.select({ id: groups.id, villageId: groups.villageId }).from(groups).where(and(eq(groups.id, parsed.data.groupId), eq(groups.isActive, true))).limit(1);
  if (!village || !group || group.villageId !== village.id) return jsonError("Desa dan kelompok yang dipilih tidak sesuai.");
  const normalizedFullName = normalizePersonName(parsed.data.fullName);
  try {
    await db.insert(attendances).values({ ...parsed.data, normalizedFullName, eventId: event.id });
  } catch (error) {
    if (!isUniqueError(error)) throw error;
  }
  return NextResponse.json({ success: true, message: "Pendaftaran telah diproses." });
}
