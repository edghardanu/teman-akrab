"use client";

import { Activity, ArrowDown, ArrowDownToLine, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Filter, RefreshCw, Search, UsersRound, UserRoundCheck } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { safeJson } from "@/components/api-json";

type EventOption = { id: number; name: string; status: string; eventDate: string };
type Stats = { event?: { id: number; name: string; status: string } | null; events: EventOption[]; summary: { total: number; activeVillages: number; activeGroups: number; averageAge: number }; villages: { id: number; name: string; total: number }[]; groups: { id: number; name: string; villageId: number; total: number }[]; ages: { label: string; total: number }[] };
type Person = { id: number; fullName: string; villageName: string; groupName: string; age: number; occupation: string; createdAt: string };

const COLORS = ["#315e4d", "#718d62", "#a2b47b", "#d4dca9", "#d38c68", "#b5c1a3"];
const emptyStats: Stats = { events: [], summary: { total: 0, activeVillages: 0, activeGroups: 0, averageAge: 0 }, villages: [], groups: [], ages: [] };
const money = new Intl.NumberFormat("id-ID");

function attendanceDate(date: string) { return new Date(date.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(date) ? date : `${date.replace(" ", "T")}Z`); }
function formatDate(date: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(attendanceDate(date)); }
function formatTime(date: string) { return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(attendanceDate(date)); }

export function DashboardView() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [eventId, setEventId] = useState("");
  const [villageId, setVillageId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [people, setPeople] = useState<Person[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(0);
  const [page, setPage] = useState(1);
  const [sort, setSort] = useState("createdAt");
  const [direction, setDirection] = useState("desc");
  const [loading, setLoading] = useState(true);
  const [tableLoading, setTableLoading] = useState(true);
  const [error, setError] = useState("");
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  const loadStats = useCallback(async () => {
    const params = new URLSearchParams();
    if (eventId) params.set("eventId", eventId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const response = await fetch(`/api/admin/stats?${params}`, { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await safeJson<Stats & { error?: string }>(response);
      if (!response.ok) throw new Error(data.error ?? "Data belum dapat dimuat.");
      setStats(data);
      if (!eventId && data.event?.id) setEventId(String(data.event.id));
      setLastUpdated(new Date()); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Data belum dapat dimuat."); }
    finally { setLoading(false); }
  }, [eventId, from, to]);

  const loadPeople = useCallback(async () => {
    if (!eventId) { setPeople([]); setTotal(0); setPages(0); setTableLoading(false); return; }
    setTableLoading(true);
    const params = new URLSearchParams({ eventId, page: String(page), pageSize: "10", sort, direction });
    if (search) params.set("q", search);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    try {
      const response = await fetch(`/api/admin/attendances?${params}`, { cache: "no-store" });
      if (response.status === 401) { window.location.assign("/admin/login"); return; }
      const data = await safeJson<{ attendances?: Person[]; total?: number; pages?: number; error?: string }>(response);
      setPeople(data.attendances ?? []); setTotal(data.total ?? 0); setPages(data.pages ?? 0);
    } catch { setPeople([]); }
    finally { setTableLoading(false); }
  }, [eventId, page, search, from, to, sort, direction]);

  useEffect(() => { void loadStats(); const timer = window.setInterval(() => void loadStats(), 30_000); return () => window.clearInterval(timer); }, [loadStats]);
  useEffect(() => { void loadPeople(); }, [loadPeople]);
  useEffect(() => { const timer = window.setInterval(() => void loadPeople(), 30_000); return () => window.clearInterval(timer); }, [loadPeople]);

  const visibleGroups = useMemo(() => stats.groups.filter((group) => villageId === "all" || group.villageId === Number(villageId)), [stats.groups, villageId]);
  const exportUrl = useMemo(() => { const params = new URLSearchParams({ eventId }); if (from) params.set("from", from); if (to) params.set("to", to); return `/api/admin/attendances/export?${params}`; }, [eventId, from, to]);
  const changeSort = (column: string) => { if (sort === column) setDirection((value) => value === "asc" ? "desc" : "asc"); else { setSort(column); setDirection("asc"); } setPage(1); };
  const applySearch = (event: React.FormEvent) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); };

  const statCards = [
    { label: "Total hadir", value: money.format(stats.summary.total), detail: "peserta tercatat", icon: UserRoundCheck, tint: "#e8f0df" },
    { label: "Desa terwakili", value: `${stats.summary.activeVillages} / 4`, detail: "wilayah hadir", icon: UsersRound, tint: "#e9efee" },
    { label: "Kelompok asal", value: money.format(stats.summary.activeGroups), detail: "kelompok terwakili", icon: Activity, tint: "#f3eadf" },
    { label: "Rata-rata umur", value: `${stats.summary.averageAge}`, detail: "tahun", icon: CircleHelp, tint: "#eeece1" },
  ];

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-moss"><span className="h-1.5 w-1.5 rounded-full bg-[#81a269]" /> data kegiatan</div><h1 className="text-[28px] font-bold tracking-[-.045em] sm:text-[32px]">Ringkasan kehadiran</h1><p className="mt-1.5 text-[12px] text-[#879088]">Lihat sebaran jamaah dan pantau daftar hadir.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Kegiatan</label><div className="relative min-w-[200px]"><select value={eventId} onChange={(e) => { setEventId(e.target.value); setPage(1); }} className="h-10 w-full appearance-none rounded-xl border border-[#e5e6dc] bg-white pl-3 pr-9 text-[11px] font-semibold outline-none focus:border-moss">{stats.events.map((event) => <option key={event.id} value={event.id}>{event.name}</option>)}{!stats.events.length && <option value="">Belum ada kegiatan</option>}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-[13px] text-[#859087]" /></div></div>
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Dari tanggal</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-[#e5e6dc] bg-white px-3 text-[11px] outline-none focus:border-moss" /></div>
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Sampai</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-[#e5e6dc] bg-white px-3 text-[11px] outline-none focus:border-moss" /></div>
        <button onClick={() => { void loadStats(); void loadPeople(); }} title="Perbarui data" className="btn-secondary h-10 w-10 px-0"><RefreshCw size={14} /></button>
      </div>
    </div>
    {error && <div className="mb-5 rounded-xl border border-[#f1d6ce] bg-[#fff6f2] px-4 py-3 text-[12px] text-[#a34f3b]">{error}</div>}
    {!stats.events.length && !loading && <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#e6ddbf] bg-[#fbf6e6] p-5 sm:flex-row sm:items-center"><div><p className="text-[13px] font-bold text-[#665733]">Belum ada kegiatan</p><p className="mt-1 text-[11px] text-[#837a63]">Buat kegiatan dan aktifkan agar peserta bisa mulai mengisi kehadiran.</p></div><a className="btn-primary" href="/admin/kegiatan">Kelola kegiatan <ArrowDown size={14} className="rotate-[-90deg]" /></a></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{statCards.map(({ label, value, detail, icon: Icon, tint }) => <div key={label} className="card flex items-center justify-between p-4 sm:p-5"><div><p className="text-[10px] font-semibold text-[#89928b]">{label}</p><p className="mt-2 text-[25px] font-bold tracking-[-.04em]">{loading ? "—" : value}</p><p className="mt-1 text-[9px] text-[#a1a69f]">{detail}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-[14px] text-forest" style={{ background: tint }}><Icon size={18} /></div></div>)}</div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <div className="card p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold">Kehadiran per desa</h2><p className="mt-1 text-[10px] text-[#959c94]">Sebaran jamaah di empat wilayah.</p></div><span className="rounded-lg bg-[#f0f3e9] px-2 py-1 text-[9px] font-bold text-forest">{stats.summary.activeVillages} DESA</span></div><div className="mt-4 h-[240px] w-full">{stats.summary.total ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.villages} dataKey="total" nameKey="name" innerRadius={64} outerRadius={89} paddingAngle={3} stroke="none">{stats.villages.map((entry, index) => <Cell key={entry.id} fill={COLORS[index % COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [`${value} jamaah`, "Hadir"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada data kehadiran.</div>}</div><div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2">{stats.villages.map((village, index) => <div key={village.id} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[10px] text-[#718078]"><i className="h-2 w-2 rounded-full" style={{ background: COLORS[index % COLORS.length] }} />{village.name}</span><strong className="text-[10px]">{village.total}</strong></div>)}</div></div>
      <div className="card p-5 sm:p-6"><div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start"><div><h2 className="text-[14px] font-bold">Kehadiran per kelompok</h2><p className="mt-1 text-[10px] text-[#959c94]">Bandingkan kelompok asal peserta.</p></div><div className="relative"><Filter size={12} className="pointer-events-none absolute left-3 top-[12px] text-[#88938a]" /><select value={villageId} onChange={(e) => setVillageId(e.target.value)} className="h-9 appearance-none rounded-xl border border-[#e6e7dd] bg-white pl-8 pr-8 text-[10px] font-semibold outline-none"><option value="all">Semua desa</option>{stats.villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-3 top-[13px] text-[#89948b]" /></div></div><div className="mt-5 h-[280px]">{visibleGroups.length && stats.summary.total ? <ResponsiveContainer width="100%" height="100%"><BarChart data={visibleGroups} margin={{ top: 8, right: 3, bottom: 30, left: -20 }}><CartesianGrid stroke="#edf0e8" vertical={false} /><XAxis dataKey="name" tick={{ fontSize: 9, fill: "#869087" }} axisLine={false} tickLine={false} angle={-23} textAnchor="end" interval={0} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "#9ba199" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f5ed" }} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /><Bar dataKey="total" name="Jamaah" fill="#6f8e63" radius={[6, 6, 0, 0]} maxBarSize={32} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada kelompok hadir.</div>}</div></div>
    </div>
    <div className="card mt-4 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-[14px] font-bold">Kehadiran per rentang umur</h2><p className="mt-1 text-[10px] text-[#959c94]">Komposisi umur jamaah yang hadir.</p></div><span className="rounded-lg bg-[#f7f1e9] px-2 py-1 text-[9px] font-bold text-[#a06b4e]">USIA</span></div><div className="mt-4 h-[200px]">{stats.summary.total ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.ages} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}><CartesianGrid stroke="#edf0e8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#869087" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "#9ba199" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f5ed" }} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /><Bar dataKey="total" name="Jamaah" fill="#d48b68" radius={[6, 6, 0, 0]} maxBarSize={44} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada data umur.</div>}</div></div>
    <div className="card mt-4 overflow-hidden">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:px-6"><div><h2 className="text-[14px] font-bold">Daftar hadir</h2><p className="mt-1 text-[10px] text-[#959c94]">{total ? `${money.format(total)} peserta terdaftar` : "Data peserta dari kegiatan terpilih."}{lastUpdated && <span> · Diperbarui {formatTime(lastUpdated.toISOString())}</span>}</p></div><div className="flex flex-wrap items-center gap-2"><form onSubmit={applySearch} className="relative"><Search size={14} className="absolute left-3 top-[12px] text-[#929a92]" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cari nama / pekerjaan" className="h-9 w-[190px] rounded-xl border border-[#e5e6dc] bg-white pl-9 pr-3 text-[10px] outline-none focus:border-moss" /></form><a href={eventId ? exportUrl : undefined} aria-disabled={!eventId} className={`btn-secondary h-9 ${!eventId ? "pointer-events-none opacity-45" : ""}`}><ArrowDownToLine size={14} /> Ekspor CSV</a></div></div>
      <div className="admin-scroll overflow-x-auto"><table className="w-full min-w-[780px] border-collapse text-left"><thead><tr className="border-y border-[#eeeee7] bg-[#fbfbf8] text-[9px] font-bold uppercase tracking-[.1em] text-[#939b93]"><th className="px-6 py-3"><button onClick={() => changeSort("fullName")} className="flex items-center gap-1">Nama {sort === "fullName" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th><th className="px-4 py-3">Desa</th><th className="px-4 py-3">Kelompok asal</th><th className="px-4 py-3"><button onClick={() => changeSort("age")} className="flex items-center gap-1">Umur {sort === "age" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th><th className="px-4 py-3">Pekerjaan</th><th className="px-6 py-3"><button onClick={() => changeSort("createdAt")} className="flex items-center gap-1">Waktu absen {sort === "createdAt" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th></tr></thead><tbody>{tableLoading ? <tr><td colSpan={6} className="px-6 py-12 text-center text-[11px] text-[#9ca39b]">Memuat daftar hadir...</td></tr> : people.length ? people.map((person) => <tr key={person.id} className="border-b border-[#f0f0e9] text-[11px] last:border-0 hover:bg-[#fcfcf9]"><td className="px-6 py-3.5 font-bold text-ink">{person.fullName}</td><td className="px-4 py-3.5 text-[#748078]">{person.villageName}</td><td className="px-4 py-3.5 text-[#748078]">{person.groupName}</td><td className="px-4 py-3.5 text-[#748078]">{person.age} th</td><td className="px-4 py-3.5 text-[#748078]">{person.occupation}</td><td className="px-6 py-3.5 text-[#879089]">{formatDate(person.createdAt)} · {formatTime(person.createdAt)}</td></tr>) : <tr><td colSpan={6} className="px-6 py-12 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f3eb] text-moss"><CalendarDays size={17} /></div><p className="mt-3 text-[11px] font-semibold text-[#7c877e]">Belum ada peserta untuk ditampilkan.</p><p className="mt-1 text-[10px] text-[#a0a69e]">Data hadir akan muncul setelah peserta mengisi formulir.</p></td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-[#eeeee7] px-5 py-3 sm:px-6"><span className="text-[10px] text-[#929b93]">Halaman {pages ? page : 0} dari {pages}</span><div className="flex gap-1"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Halaman sebelumnya" className="btn-secondary h-8 w-8 px-0 disabled:opacity-40"><ChevronLeft size={14} /></button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} aria-label="Halaman berikutnya" className="btn-secondary h-8 w-8 px-0 disabled:opacity-40"><ChevronRight size={14} /></button></div></div>
    </div>
    <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-[#a0a69e]"><RefreshCw size={11} /> Data diperbarui otomatis setiap 30 detik.</div>
  </div>;
}
