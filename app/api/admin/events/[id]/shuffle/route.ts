import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventGroupMembers, eventGroups, groups, villages } from "@/lib/schema";

type Params = { params: Promise<{ id: string }> };
type Person = { id: number; fullName: string; villageId: number; villageName: string; groupName: string; age: number; occupation: string };
type PreviewGroup = { name: string; members: Person[] };

function randomIndex(max: number) {
  if (max <= 1) return 0;
  const range = 0x1_0000_0000;
  const limit = Math.floor(range / max) * max;
  const bytes = new Uint32Array(1);
  let value = 0;
  do { crypto.getRandomValues(bytes); value = bytes[0]; } while (value >= limit);
  return value % max;
}
function shuffle<T>(items: T[]) {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = randomIndex(i + 1);
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export async function GET(request: NextRequest, { params }: Params) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const eventId = Number((await params).id);
  if (!Number.isInteger(eventId) || eventId < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const db = getDb();
  const rows = await db.select({ groupId: eventGroups.id, name: eventGroups.name, attendanceId: attendances.id, fullName: attendances.fullName, age: attendances.age, occupation: attendances.occupation, villageName: villages.name, groupName: groups.name })
    .from(eventGroups).leftJoin(eventGroupMembers, eq(eventGroups.id, eventGroupMembers.eventGroupId)).leftJoin(attendances, eq(eventGroupMembers.attendanceId, attendances.id)).leftJoin(villages, eq(attendances.villageId, villages.id)).leftJoin(groups, eq(attendances.groupId, groups.id)).where(eq(eventGroups.eventId, eventId)).orderBy(asc(eventGroups.id), asc(attendances.fullName));
  const result = new Map<number, { name: string; members: Omit<Person, "villageId">[] }>();
  rows.forEach((row) => {
    if (!result.has(row.groupId)) result.set(row.groupId, { name: row.name, members: [] });
    if (row.attendanceId && row.fullName) result.get(row.groupId)!.members.push({ id: row.attendanceId, fullName: row.fullName, age: row.age!, occupation: row.occupation!, villageName: row.villageName ?? "", groupName: row.groupName ?? "" });
  });
  return NextResponse.json({ groups: [...result.values()], saved: result.size > 0 });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const eventId = Number((await params).id);
  if (!Number.isInteger(eventId) || eventId < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const payload = await request.json().catch(() => null) as { mode?: string; value?: number; balanceVillages?: boolean } | null;
  if (!payload || !["count", "size"].includes(payload.mode ?? "") || !Number.isInteger(payload.value) || payload.value! < 1 || payload.value! > 100) return jsonError("Masukkan jumlah kelompok 1–100 atau anggota per kelompok 1–100.");
  const db = getDb();
  const people = await db.select({ id: attendances.id, fullName: attendances.fullName, villageId: attendances.villageId, villageName: villages.name, groupName: groups.name, age: attendances.age, occupation: attendances.occupation })
    .from(attendances).innerJoin(villages, eq(attendances.villageId, villages.id)).innerJoin(groups, eq(attendances.groupId, groups.id)).where(eq(attendances.eventId, eventId)).orderBy(asc(attendances.id));
  if (!people.length) return jsonError("Belum ada peserta hadir untuk kegiatan ini.", 409);
  const saved = await db.select({ id: eventGroups.id }).from(eventGroups).where(eq(eventGroups.eventId, eventId)).limit(1);
  const groupCount = Math.max(1, Math.min(100, payload.mode === "count" ? payload.value! : Math.ceil(people.length / payload.value!)));
  const buckets: Person[][] = Array.from({ length: groupCount }, () => []);
  if (payload.balanceVillages) {
    const byVillage = new Map<number, Person[]>();
    people.forEach((person) => byVillage.set(person.villageId, [...(byVillage.get(person.villageId) ?? []), person]));
    for (const bucket of byVillage.values()) {
      for (const person of shuffle(bucket)) {
        const index = buckets.map((members, groupIndex) => ({ groupIndex, total: members.length, village: members.filter((member) => member.villageId === person.villageId).length }))
          .sort((a, b) => a.total - b.total || a.village - b.village || a.groupIndex - b.groupIndex)[0].groupIndex;
        buckets[index].push(person);
      }
    }
  } else {
    shuffle(people).forEach((person, index) => buckets[index % groupCount].push(person));
  }
  const groupsPreview: PreviewGroup[] = buckets.map((members, index) => ({ name: `Kelompok ${index + 1}`, members }));
  return NextResponse.json({ groups: groupsPreview, participantCount: people.length, saved: saved.length > 0, balanceVillages: Boolean(payload.balanceVillages) });
}
