import { and, asc, eq } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";
import { groups } from "@/lib/schema";

export async function GET(request: NextRequest) {
  const villageId = Number(request.nextUrl.searchParams.get("villageId"));
  if (!Number.isInteger(villageId) || villageId < 1) return NextResponse.json({ groups: [] });
  const data = await getDb().select({ id: groups.id, name: groups.name }).from(groups)
    .where(and(eq(groups.villageId, villageId), eq(groups.isActive, true))).orderBy(asc(groups.name));
  return NextResponse.json({ groups: data });
}
