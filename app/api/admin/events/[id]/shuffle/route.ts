import { asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventGroupMembers, eventGroups, groups, villages } from "@/lib/schema";
import { normalizePersonName } from "@/lib/name-normalization";

type Params = { params: Promise<{ id: string }> };
type Gender = "male" | "female" | "unknown";
type Person = { id: number; fullName: string; villageId: number; villageName: string; groupName: string; age: number | null; gender: Gender; occupation: string };
type PreviewGroup = { name: string; villageId: number | null; villageName: string | null; members: Omit<Person, "villageId">[] };

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
  const rows = await db.select({ groupId: eventGroups.id, name: eventGroups.name, attendanceId: attendances.id, fullName: attendances.fullName, age: attendances.age, gender: attendances.gender, occupation: attendances.occupation, villageId: attendances.villageId, villageName: villages.name, groupName: groups.name })
    .from(eventGroups).leftJoin(eventGroupMembers, eq(eventGroups.id, eventGroupMembers.eventGroupId)).leftJoin(attendances, eq(eventGroupMembers.attendanceId, attendances.id)).leftJoin(villages, eq(attendances.villageId, villages.id)).leftJoin(groups, eq(attendances.groupId, groups.id)).where(eq(eventGroups.eventId, eventId)).orderBy(asc(eventGroups.id), asc(attendances.fullName));
  const result = new Map<number, { name: string; members: Omit<Person, "villageId">[]; villages: Map<number, string> }>();
  const seenNames = new Set<string>();
  let duplicateNameCount = 0;
  rows.forEach((row) => {
    if (!result.has(row.groupId)) result.set(row.groupId, { name: row.name, members: [], villages: new Map() });
    if (row.attendanceId && row.fullName) {
      const normalizedName = normalizePersonName(row.fullName);
      if (seenNames.has(normalizedName)) { duplicateNameCount++; return; }
      seenNames.add(normalizedName);
      if (row.villageId && row.villageName) result.get(row.groupId)!.villages.set(row.villageId, row.villageName);
      result.get(row.groupId)!.members.push({ id: row.attendanceId, fullName: row.fullName, age: row.age, gender: row.gender ?? "unknown", occupation: row.occupation!, villageName: row.villageName ?? "", groupName: row.groupName ?? "" });
    }
  });
  const savedGroups: PreviewGroup[] = [...result.values()].map(({ name, members, villages: groupVillages }) => {
    const villageEntries = [...groupVillages.entries()];
    return { name, members, villageId: villageEntries.length === 1 ? villageEntries[0][0] : null, villageName: villageEntries.length === 1 ? villageEntries[0][1] : villageEntries.length > 1 ? "Lintas desa" : null };
  });
  return NextResponse.json({ groups: savedGroups, saved: result.size > 0, duplicateNameCount });
}

export async function POST(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const eventId = Number((await params).id);
  if (!Number.isInteger(eventId) || eventId < 1) return jsonError("Kegiatan tidak ditemukan.", 404);
  const payload = await request.json().catch(() => null) as { mode?: string; value?: number } | null;
  if (!payload || !["count", "size"].includes(payload.mode ?? "") || !Number.isInteger(payload.value) || payload.value! < 1 || payload.value! > 100) return jsonError("Masukkan jumlah kelompok 1–100 atau anggota per kelompok 1–100.");
  const db = getDb();
  const registeredPeople = await db.select({ id: attendances.id, fullName: attendances.fullName, villageId: attendances.villageId, villageName: villages.name, groupName: groups.name, age: attendances.age, gender: attendances.gender, occupation: attendances.occupation })
    .from(attendances).innerJoin(villages, eq(attendances.villageId, villages.id)).innerJoin(groups, eq(attendances.groupId, groups.id)).where(eq(attendances.eventId, eventId)).orderBy(asc(attendances.id));
  if (!registeredPeople.length) return jsonError("Belum ada peserta hadir untuk kegiatan ini.", 409);
  const seenNames = new Set<string>();
  const people = registeredPeople.filter((person) => {
    const normalizedName = normalizePersonName(person.fullName);
    if (seenNames.has(normalizedName)) return false;
    seenNames.add(normalizedName);
    return true;
  });
  const duplicateNameCount = registeredPeople.length - people.length;
  const saved = await db.select({ id: eventGroups.id }).from(eventGroups).where(eq(eventGroups.eventId, eventId)).limit(1);
  if (payload.mode === "count" && payload.value! > people.length) return jsonError(`Jumlah peserta hanya ${people.length}. Kurangi jumlah kelompok.`);
  const groupCount = payload.mode === "count" ? payload.value! : Math.ceil(people.length / payload.value!);
  if (groupCount > 100) return jsonError("Pembagian menghasilkan lebih dari 100 kelompok. Tambah anggota per kelompok.");
  const buckets: Person[][] = Array.from({ length: groupCount }, () => []);
  const genderCounts = buckets.map(() => ({ male: 0, female: 0, unknown: 0 }));
  for (const gender of ["male", "female", "unknown"] as const) {
    for (const person of shuffle(people.filter((entry) => entry.gender === gender))) {
      const candidates = buckets.map((members, groupIndex) => ({
        groupIndex,
        sameGender: genderCounts[groupIndex][gender],
        total: members.length,
      }));
      const minimumGenderCount = Math.min(...candidates.map((candidate) => candidate.sameGender));
      const minimumTotal = Math.min(...candidates.filter((candidate) => candidate.sameGender === minimumGenderCount).map((candidate) => candidate.total));
      const tied = candidates.filter((candidate) => candidate.sameGender === minimumGenderCount && candidate.total === minimumTotal);
      const target = tied[randomIndex(tied.length)].groupIndex;
      buckets[target].push(person);
      genderCounts[target][gender]++;
    }
  }
  const groupsPreview = buckets.map((members, index) => ({
    name: `Kelompok ${index + 1}`,
    villageId: null,
    villageName: "Lintas desa",
    members: shuffle(members),
  }));
  return NextResponse.json({ groups: groupsPreview, participantCount: people.length, duplicateNameCount, saved: saved.length > 0, grouping: "mixed" });
}
