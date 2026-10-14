import { asc, eq } from "drizzle-orm";
import { NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { villages } from "@/lib/schema";

export async function GET() {
  const data = await getDb().select({ id: villages.id, name: villages.name }).from(villages).where(eq(villages.isActive, true)).orderBy(asc(villages.name));
  return NextResponse.json({ villages: data });
}
