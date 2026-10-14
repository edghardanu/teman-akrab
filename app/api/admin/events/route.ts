import { desc, eq, count } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin, sameOrigin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { attendances, events } from "@/lib/schema";
import { eventSchema } from "@/lib/validation";

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const db = getDb();
  const rows = await db.select().from(events).orderBy(desc(events.eventDate), desc(events.id));
  const counts = await db.select({ eventId: attendances.eventId, total: count() }).from(attendances).groupBy(attendances.eventId);
  const countByEvent = new Map(counts.map((row) => [row.eventId, row.total]));
  return NextResponse.json({ events: rows.map((event) => ({ ...event, attendanceCount: countByEvent.get(event.id) ?? 0 })) });
}

export async function POST(request: NextRequest) {
  if (!sameOrigin(request)) return jsonError("Permintaan tidak valid.", 403);
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);
  const parsed = eventSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return jsonError(parsed.error.issues[0]?.message ?? "Data kegiatan belum lengkap.");
  const db = getDb();
  if (parsed.data.status === "active") await db.update(events).set({ status: "draft" }).where(eq(events.status, "active"));
  const [event] = await db.insert(events).values({ ...parsed.data, description: parsed.data.description || null }).returning();
  return NextResponse.json({ event }, { status: 201 });
}
