import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { isUniqueError, jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, eventGroupMembers, groups, villages } from "@/lib/schema";
import { normalizePersonName } from "@/lib/name-normalization";
import { z } from "zod";

type Params = { params: Promise<{ id: string }> };

function isValidJakartaDateTime(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(value);
  if (!match) return false;
  const [, yearText, monthText, dayText, hourText, minuteText] = match;
  const year = Number(yearText); const month = Number(monthText); const day = Number(dayText);
  const hour = Number(hourText); const minute = Number(minuteText);
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  return year > 0 && month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth && hour <= 23 && minute <= 59;
}

const adminAttendanceSchema = z.object({
  fullName: z.string().trim().min(3, "Nama minimal 3 karakter.").max(100, "Nama maksimal 100 karakter."),
  villageId: z.coerce.number().int().positive("Pilih desa terlebih dahulu."),
  groupId: z.coerce.number().int().positive("Pilih kelompok terlebih dahulu."),
  age: z.preprocess((value) => value === "" || value === null ? null : value, z.coerce.number().int().min(5, "Umur minimal 5 tahun.").max(100, "Umur maksimal 100 tahun.").nullable()),
  gender: z.enum(["male", "female", "unknown"]),
  occupation: z.string().trim().min(1, "Pekerjaan wajib diisi.").max(100, "Pekerjaan maksimal 100 karakter."),
  additionalNotes: z.string().trim().max(1000, "Keterangan tambahan maksimal 1000 karakter.").optional().default(""),
  createdAt: z.string().refine(isValidJakartaDateTime, "Waktu absen tidak valid."),
});

export async function PATCH(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Data kehadiran tidak ditemukan.", 404);

  const parsed = adminAttendanceSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa kembali data peserta.");

  const db = getDb();
  const [group] = await db.select({ id: groups.id, villageId: groups.villageId }).from(groups).where(eq(groups.id, parsed.data.groupId)).limit(1);
  const [village] = await db.select({ id: villages.id }).from(villages).where(eq(villages.id, parsed.data.villageId)).limit(1);
  if (!village || !group || group.villageId !== village.id) return jsonError("Desa dan kelompok yang dipilih tidak sesuai.");

  try {
    const createdAt = new Date(`${parsed.data.createdAt}:00+07:00`).toISOString().replace("T", " ").slice(0, 19);
    const [attendance] = await db.update(attendances).set({
      ...parsed.data,
      additionalNotes: parsed.data.additionalNotes || null,
      normalizedFullName: normalizePersonName(parsed.data.fullName),
      createdAt,
    }).where(eq(attendances.id, id)).returning({ id: attendances.id });
    return attendance ? NextResponse.json({ success: true }) : jsonError("Data kehadiran tidak ditemukan.", 404);
  } catch (error) {
    if (isUniqueError(error)) return jsonError("Peserta dengan nama, desa, dan kelompok tersebut sudah tercatat.", 409);
    throw error;
  }
}

export async function DELETE(request: NextRequest, { params }: Params) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);

  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) return jsonError("Data kehadiran tidak ditemukan.", 404);

  const db = getDb();
  const [attendance] = await db.select({ id: attendances.id }).from(attendances).where(eq(attendances.id, id)).limit(1);
  if (!attendance) return jsonError("Data kehadiran tidak ditemukan.", 404);

  await db.transaction(async (tx) => {
    await tx.delete(eventGroupMembers).where(eq(eventGroupMembers.attendanceId, id));
    await tx.delete(attendances).where(eq(attendances.id, id));
  });

  return NextResponse.json({ success: true });
}
