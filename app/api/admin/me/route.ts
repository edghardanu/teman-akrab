import { NextRequest, NextResponse } from "next/server";
import { requireAdmin } from "@/lib/auth";
import { jsonError } from "@/lib/api";

export async function GET(request: NextRequest) {
  const admin = await requireAdmin(request);
  if (!admin) return jsonError("Silakan masuk kembali.", 401);
  return NextResponse.json({ admin: { username: admin.username, mustChangePassword: admin.mustChangePassword } });
}
