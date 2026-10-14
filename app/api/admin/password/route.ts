import { eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { hashPassword, requireAdmin, sameOrigin, verifyPassword } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { getDb } from "@/lib/db";
import { admins } from "@/lib/schema";
import { passwordSchema } from "@/lib/validation";

export async function PATCH(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Silakan masuk kembali.", 401);
  const parsed = passwordSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Periksa kata sandi.");
  const [record] = await getDb().select().from(admins).where(eq(admins.id, admin.id)).limit(1);
  if (!record || !await verifyPassword(parsed.data.currentPassword, record.passwordHash)) return jsonError("Kata sandi saat ini tidak sesuai.", 401);
  await getDb().update(admins).set({ passwordHash: await hashPassword(parsed.data.newPassword), mustChangePassword: false }).where(eq(admins.id, admin.id));
  return NextResponse.json({ success: true });
}
