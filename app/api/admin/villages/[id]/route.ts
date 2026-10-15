import { count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventVillages, groups, villages } from "@/lib/schema";
import { villageSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  const payload = await request.json().catch(() => null) as { isActive?: boolean; name?: string } | null;
  if (!Number.isInteger(id) || id < 1 || !payload) return jsonError("Periksa data desa.");
  if (typeof payload.isActive === "boolean") {
    const [village] = await getDb().update(villages).set({ isActive: payload.isActive }).where(eq(villages.id, id)).returning();
    return village ? NextResponse.json({ village }) : jsonError("Desa tidak ditemukan.", 404);
  }
  const parsed = villageSchema.safeParse(payload);
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa nama desa.");
  const db = getDb();
  const [existingVillage] = await db.select({ id: villages.id }).from(villages).where(eq(villages.id, id)).limit(1);
  if (!existingVillage) return jsonError("Desa tidak ditemukan.", 404);
  if (parsed.data.groupNames.length) {
    const existingGroups = await db.select({ name: groups.name }).from(groups).where(eq(groups.villageId, id));
    const existingNames = new Set(existingGroups.map((group) => group.name.toLocaleLowerCase("id-ID")));
    if (parsed.data.groupNames.some((name) => existingNames.has(name.toLocaleLowerCase("id-ID")))) {
      return jsonError("Nama kelompok sudah terdaftar di desa ini.", 409);
    }
  }
  try {
    const [village] = await db.update(villages).set({ name: parsed.data.name }).where(eq(villages.id, id)).returning();
    if (!village) return jsonError("Desa tidak ditemukan.", 404);
    const createdGroups = parsed.data.groupNames.length
      ? await db.insert(groups).values(parsed.data.groupNames.map((name) => ({ name, villageId: id }))).returning()
      : [];
    return NextResponse.json({ village, groups: createdGroups });
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Nama desa tersebut sudah digunakan.", 409);
    throw error;
  }
}
export async function DELETE(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Desa tidak ditemukan.", 404);
  const db = getDb();
  const [groupCount] = await db.select({ value: count() }).from(groups).where(eq(groups.villageId, id));
  const [personCount] = await db.select({ value: count() }).from(attendances).where(eq(attendances.villageId, id));
  const [eventCount] = await db.select({ value: count() }).from(eventVillages).where(eq(eventVillages.villageId, id));
  if ((groupCount?.value ?? 0) || (personCount?.value ?? 0) || (eventCount?.value ?? 0)) {
    await db.update(villages).set({ isActive: false }).where(eq(villages.id, id));
    return NextResponse.json({ deactivated: true, message: "Desa masih digunakan oleh kelompok, kegiatan, atau riwayat absensi, jadi desa dinonaktifkan." });
  }
  const [removed] = await db.delete(villages).where(eq(villages.id, id)).returning({ id: villages.id });
  return removed ? NextResponse.json({ success: true }) : jsonError("Desa tidak ditemukan.", 404);
}
