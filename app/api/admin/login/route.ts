import { NextRequest, NextResponse } from "next/server";
import { createSession, loginAdmin, sessionCookie } from "@/lib/auth";
import { jsonError } from "@/lib/api";
import { loginSchema } from "@/lib/validation";

export async function POST(request: NextRequest) {
  const payload = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(payload);
  if (!parsed.success) return jsonError("Masukkan username dan kata sandi.");
  const ip = request.headers.get("cf-connecting-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const result = await loginAdmin(parsed.data.username.trim().toLowerCase(), parsed.data.password, ip);
  if (!result.ok) return jsonError(result.locked ? "Terlalu banyak percobaan. Coba lagi dalam 15 menit." : "Username atau kata sandi tidak sesuai.", result.locked ? 429 : 401);
  const token = await createSession(result.admin.id, result.admin.username);
  const response = NextResponse.json({ success: true, mustChangePassword: result.admin.mustChangePassword });
  response.headers.set("Set-Cookie", sessionCookie(token, request.nextUrl.protocol === "https:"));
  return response;
}
