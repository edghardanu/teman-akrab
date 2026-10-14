import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventGroupMembers, eventGroups } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };
type Payload = { overwrite?: boolean; groups?: { name?: string; attendanceIds?: number[] }[] };

export async function POST(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const eventId = Number((await params).id);
  if (!Number.isInteger(eventId) || eventId < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const payload = await request.json().catch(() => null) as Payload | null;
  const groupsPayload = payload?.groups;
  if (!Array.isArray(groupsPayload) || !groupsPayload.length || groupsPayload.length > 100 || groupsPayload.some((group) => !Array.isArray(group.attendanceIds))) return jsonError("Pratinjau pembagian tidak valid.");
  const ids = groupsPayload.flatMap((group) => group.attendanceIds ?? []);
  if (!ids.length || ids.some((id) => !Number.isInteger(id)) || new Set(ids).size !== ids.length) return jsonError("Setiap peserta hanya boleh ditempatkan satu kali.");
  const db = getDb();
  const existing = await db.select({ id: eventGroups.id }).from(eventGroups).where(eq(eventGroups.eventId, eventId)).limit(1);
  if (existing.length && !payload?.overwrite) return jsonError("Pembagian sebelumnya sudah tersimpan. Konfirmasi untuk menggantinya.", 409);
  const participants = await db.select({ id: attendances.id }).from(attendances).where(eq(attendances.eventId, eventId));
  const validIds = new Set(participants.map((person) => person.id));
  if (validIds.size !== ids.length || ids.some((id) => !validIds.has(id))) return jsonError("Daftar peserta berubah. Acak ulang sebelum menyimpan.", 409);
  const sizes = groupsPayload.map((group) => group.attendanceIds!.length);
  if (Math.max(...sizes) - Math.min(...sizes) > 1) return jsonError("Jumlah peserta antar kelompok harus berbeda maksimal satu orang.");
  await db.delete(eventGroups).where(eq(eventGroups.eventId, eventId));
  const createdGroups: { id: number }[] = [];
  for (let offset = 0; offset < groupsPayload.length; offset += 50) {
    const chunk = groupsPayload.slice(offset, offset + 50);
    const inserted = await db.insert(eventGroups).values(chunk.map((group, index) => ({ eventId, name: group.name?.trim() || `Kelompok ${offset + index + 1}` }))).returning({ id: eventGroups.id });
    createdGroups.push(...inserted);
  }
  const members = groupsPayload.flatMap((group, index) => group.attendanceIds!.map((attendanceId) => ({ eventGroupId: createdGroups[index].id, attendanceId })));
  for (let offset = 0; offset < members.length; offset += 50) await db.insert(eventGroupMembers).values(members.slice(offset, offset + 50));
  return NextResponse.json({ success: true, groupCount: groupsPayload.length, participantCount: ids.length });
}
