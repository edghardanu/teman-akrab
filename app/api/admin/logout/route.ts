import { NextRequest, NextResponse } from "next/server";
import { clearSessionCookie } from "@/lib/auth";

export async function POST(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  response.headers.set("Set-Cookie", clearSessionCookie(request.nextUrl.protocol === "https:"));
  return response;
}
