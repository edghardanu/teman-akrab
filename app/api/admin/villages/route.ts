import { asc, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, groups, villages } from "@/lib/schema";
import { villageSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const db = getDb();
  const rows = await db.select().from(villages).orderBy(asc(villages.name));
  const groupCounts = await db.select({ villageId: groups.villageId, total: count() }).from(groups).groupBy(groups.villageId);
  const peopleCounts = await db.select({ villageId: attendances.villageId, total: count() }).from(attendances).groupBy(attendances.villageId);
  return NextResponse.json({ villages: rows.map((village) => ({ ...village, groupCount: groupCounts.find((item) => item.villageId === village.id)?.total ?? 0, attendanceCount: peopleCounts.find((item) => item.villageId === village.id)?.total ?? 0 })) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const parsed = villageSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Nama desa minimal 2 karakter.");
  try {
    const db = getDb();
    const [village] = await db.insert(villages).values({ name: parsed.data.name }).returning();
    const createdGroups = parsed.data.groupNames.length
      ? await db.insert(groups).values(parsed.data.groupNames.map((name) => ({ name, villageId: village.id }))).returning()
      : [];
    return NextResponse.json({ village, groups: createdGroups }, { status: 201 });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Nama desa tersebut sudah digunakan.", 409);
    throw error;
  }
}
