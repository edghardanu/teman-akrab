import { and, asc, eq, gte, inArray, lte } from "drizzle-orm";
import { NextRequest, NextResponse } from "next/server";
import { jsonError } from "@/lib/api";
import { requireAdmin } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { jakartaDateBound } from "@/lib/dates";
import { attendances, events, groups, villages } from "@/lib/schema";

function escapeHtml(value: unknown) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  })[character]!);
}

function formatAttendanceTime(value: string) {
  const date = new Date(value.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(value) ? value : `${value.replace(" ", "T")}Z`);
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Jakarta",
  }).format(date);
}

export async function GET(request: NextRequest) {
  if (!await requireAdmin(request)) return jsonError("Silakan masuk kembali.", 401);

  const params = request.nextUrl.searchParams;
  const locationFilter = params.get("location");
  const eventValue = params.get("eventId");
  const allEventsSelected = eventValue === "all";
  const eventId = Number(eventValue);
  if (locationFilter === null && !allEventsSelected && (!Number.isInteger(eventId) || eventId < 1)) {
    return jsonError("Pilih kegiatan terlebih dahulu.");
  }

  const villageValue = params.get("villageId");
  let villageId: number | null = null;
  if (villageValue && villageValue !== "all") {
    const parsedVillageId = Number(villageValue);
    if (!Number.isInteger(parsedVillageId) || parsedVillageId < 1) return jsonError("Filter desa tidak valid.");
    villageId = parsedVillageId;
  }

  const db = getDb();
  const conditions = [];
  let eventLabel = "Semua kegiatan";
  if (locationFilter !== null) {
    if (locationFilter !== "all") {
      eventLabel = locationFilter;
      const matchingEvents = await db.select({ id: events.id }).from(events).where(eq(events.location, locationFilter));
      const matchingEventIds = matchingEvents.map((event) => event.id);
      conditions.push(matchingEventIds.length ? inArray(attendances.eventId, matchingEventIds) : eq(attendances.eventId, -1));
    }
  } else if (!allEventsSelected) {
    conditions.push(eq(attendances.eventId, eventId));
    const [selectedEvent] = await db.select({ name: events.name }).from(events).where(eq(events.id, eventId)).limit(1);
    eventLabel = selectedEvent?.name ?? `Kegiatan ${eventId}`;
  }
  if (villageId !== null) conditions.push(eq(attendances.villageId, villageId));
  if (params.get("from")) conditions.push(gte(attendances.createdAt, jakartaDateBound(params.get("from")!)));
  if (params.get("to")) conditions.push(lte(attendances.createdAt, jakartaDateBound(params.get("to")!, true)));

  const [selectedVillage] = villageId === null
    ? []
    : await db.select({ name: villages.name }).from(villages).where(eq(villages.id, villageId)).limit(1);
  const rows = await db.select({
    eventName: events.name,
    fullName: attendances.fullName,
    villageName: villages.name,
    groupName: groups.name,
    occupation: attendances.occupation,
    additionalNotes: attendances.additionalNotes,
    createdAt: attendances.createdAt,
  }).from(attendances)
    .innerJoin(events, eq(attendances.eventId, events.id))
    .innerJoin(villages, eq(attendances.villageId, villages.id))
    .innerJoin(groups, eq(attendances.groupId, groups.id))
    .where(conditions.length ? and(...conditions) : undefined)
    .orderBy(asc(events.eventDate), asc(villages.name), asc(attendances.fullName));

  const from = params.get("from");
  const to = params.get("to");
  const filterItems = [
    ["Kegiatan", eventLabel],
    ["Desa", selectedVillage?.name ?? "Semua desa"],
    ...(from ? [["Dari tanggal", from]] : []),
    ...(to ? [["Sampai tanggal", to]] : []),
  ];
  const filterMarkup = filterItems.map(([label, value]) =>
    `<div><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong></div>`,
  ).join("");
  const rowsMarkup = rows.map((row) =>
    `<tr><td>${escapeHtml(row.eventName)}</td><td>${escapeHtml(row.fullName)}</td><td>${escapeHtml(row.villageName)}</td><td>${escapeHtml(row.groupName)}</td><td>${escapeHtml(row.occupation)}</td><td>${escapeHtml(row.additionalNotes || "—")}</td><td>${escapeHtml(formatAttendanceTime(row.createdAt))}</td></tr>`,
  ).join("");
  const html = `<!doctype html>
<html lang="id">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Laporan Kehadiran</title>
  <style>
    * { box-sizing: border-box; }
    body { color: #203b32; font: 12px Arial, sans-serif; margin: 32px auto; max-width: 980px; padding: 0 24px; }
    h1 { font-size: 23px; margin: 0 0 6px; }
    .subtitle { color: #78847c; margin: 0 0 22px; }
    .filters { border: 1px solid #e1e6df; border-radius: 8px; display: flex; flex-wrap: wrap; gap: 18px 32px; margin-bottom: 20px; padding: 12px 14px; }
    .filters div { display: grid; gap: 4px; }
    .filters span { color: #7b887f; font-size: 10px; }
    .filters strong { font-size: 11px; font-weight: 600; }
    table { border-collapse: collapse; width: 100%; }
    th, td { border-bottom: 1px solid #e8ebe6; padding: 7px 8px; text-align: left; }
    th { background: #f4f6f1; color: #56675d; font-size: 10px; text-transform: uppercase; }
    td { font-size: 10px; }
    tfoot td { background: #f4f6f1; border-top: 1px solid #dce3dc; font-weight: 700; }
    .generated { color: #89948c; font-size: 10px; margin-top: 16px; }
    @page { size: A4 landscape; margin: 14mm; }
    @media print {
      body { margin: 0; max-width: none; padding: 0; }
      thead { display: table-header-group; }
      tr { break-inside: avoid; }
      .filters { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1>Laporan Kehadiran</h1>
  <p class="subtitle">Teman Akrab · Daftar peserta berdasarkan filter yang dipilih</p>
  <section class="filters">${filterMarkup}</section>
  <table>
    <thead><tr><th>Kegiatan</th><th>Nama peserta</th><th>Desa</th><th>Kelompok</th><th>Pekerjaan</th><th>Keterangan tambahan</th><th>Waktu absen</th></tr></thead>
    <tbody>${rowsMarkup || '<tr><td colspan="7">Tidak ada data kehadiran untuk filter ini.</td></tr>'}</tbody>
    <tfoot><tr><td colspan="6">Total peserta</td><td>${rows.length.toLocaleString("id-ID")}</td></tr></tfoot>
  </table>
  <p class="generated">Dicetak pada ${escapeHtml(formatAttendanceTime(new Date().toISOString()))}</p>
  <script>window.addEventListener("load", () => window.print());</script>
</body>
</html>`;

  return new NextResponse(html, {
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
