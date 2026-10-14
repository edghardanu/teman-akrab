import { and, count, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, groups, villages } from "@/lib/schema";
import { groupSchema } from "@/lib/validation";

type Params = { params: Promise<{ id: string }> };
export async function PATCH(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  const payload = await request.json().catch(() => null) as { isActive?: boolean; name?: string; villageId?: number } | null;
  if (!Number.isInteger(id) || id < 1 || !payload) return jsonError("Periksa data kelompok.");
  if (typeof payload.isActive === "boolean") {
    const [group] = await getDb().update(groups).set({ isActive: payload.isActive }).where(eq(groups.id, id)).returning();
    return group ? NextResponse.json({ group }) : jsonError("Kelompok tidak ditemukan.", 404);
  }
  const parsed = groupSchema.safeParse(payload);
  if (!parsed.success) return jsonError("Periksa kembali kelompok.");
  const db = getDb();
  const [existing] = await db.select({ villageId: groups.villageId }).from(groups).where(eq(groups.id, id)).limit(1);
  if (!existing) return jsonError("Kelompok tidak ditemukan.", 404);
  const [people] = await db.select({ value: count() }).from(attendances).where(eq(attendances.groupId, id));
  if ((people?.value ?? 0) > 0 && parsed.data.villageId !== existing.villageId) return jsonError("Desa kelompok tidak dapat diubah karena kelompok ini sudah memiliki riwayat absensi.", 409);
  if (parsed.data.villageId !== existing.villageId) {
    const [village] = await db.select({ id: villages.id }).from(villages).where(and(eq(villages.id, parsed.data.villageId), eq(villages.isActive, true))).limit(1);
    if (!village) return jsonError("Desa tidak tersedia.");
  }
  try {
    const [group] = await db.update(groups).set(parsed.data).where(eq(groups.id, id)).returning();
    return group ? NextResponse.json({ group }) : jsonError("Kelompok tidak ditemukan.", 404);
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Nama kelompok sudah ada di desa ini.", 409);
    throw error;
  }
}
export async function DELETE(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Kelompok tidak ditemukan.", 404);
  const db = getDb();
  const [people] = await db.select({ value: count() }).from(attendances).where(eq(attendances.groupId, id));
  if ((people?.value ?? 0) > 0) {
    await db.update(groups).set({ isActive: false }).where(eq(groups.id, id));
    return NextResponse.json({ deactivated: true, message: "Kelompok memiliki riwayat absensi, jadi kelompok dinonaktifkan." });
  }
  const [removed] = await db.delete(groups).where(eq(groups.id, id)).returning({ id: groups.id });
  return removed ? NextResponse.json({ success: true }) : jsonError("Kelompok tidak ditemukan.", 404);
}
