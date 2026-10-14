import { and, asc, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, groups, villages } from "@/lib/schema";
import { groupSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const data = await getDb().select({ id: groups.id, name: groups.name, villageId: groups.villageId, isActive: groups.isActive, villageName: villages.name })
    .from(groups).innerJoin(villages, eq(groups.villageId, villages.id)).orderBy(asc(villages.name), asc(groups.name));
  const people = await getDb().select({ groupId: attendances.groupId, total: count() }).from(attendances).groupBy(attendances.groupId);
  return NextResponse.json({ groups: data.map((group) => ({ ...group, attendanceCount: people.find((row) => row.groupId === group.id)?.total ?? 0 })) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const parsed = groupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError("Nama kelompok dan desa wajib dipilih.");
  const [village] = await getDb().select({ id: villages.id }).from(villages).where(and(eq(villages.id, parsed.data.villageId), eq(villages.isActive, true))).limit(1);
  if (!village) return jsonError("Desa tidak tersedia.");
  try {
    const [group] = await getDb().insert(groups).values(parsed.data).returning();
    return NextResponse.json({ group }, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Nama kelompok sudah ada di desa ini.", 409);
    throw error;
  }
}
