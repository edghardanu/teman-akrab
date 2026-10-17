"use client";

import { Activity, ArrowDown, ArrowDownToLine, ArrowUp, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CircleHelp, Edit3, Filter, LoaderCircle, RefreshCw, Search, Trash2, UsersRound, UserRound, UserRoundCheck, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { safeJson } from "@/components/api-json";

type EventOption = { id: number; name: string; location: string; status: string; eventDate: string };
type Stats = { event?: { id: number; name: string; status: string } | null; events: EventOption[]; summary: { total: number; male: number; female: number; activeVillages: number; activeGroups: number; averageAge: number }; villages: { id: number; name: string; total: number }[]; groups: { id: number; name: string; villageId: number; total: number }[]; ages: { label: string; total: number }[] };
type Person = { id: number; eventId: number; eventLocation: string; fullName: string; villageId: number; villageName: string; groupId: number; groupName: string; age: number; gender: "male" | "female" | "unknown"; occupation: string; createdAt: string };
type VillageOption = { id: number; name: string; isActive: boolean };
type GroupOption = { id: number; name: string; villageId: number; isActive: boolean };
type AttendanceForm = { fullName: string; villageId: string; groupId: string; age: string; gender: Person["gender"]; occupation: string; createdAt: string };

const VILLAGE_COLORS = ["#315e4d", "#d17a55", "#718d62", "#648ca3"];
const GROUP_COLORS = ["#315e4d", "#c56d4f", "#73914f", "#8a6bb1", "#4385a3", "#c18a2e", "#a8556e", "#55704b", "#d07c4f", "#4d688f", "#91a644", "#b05d3a", "#4c9b8a", "#937245", "#7868a6", "#a35688"];
const emptyStats: Stats = { events: [], summary: { total: 0, male: 0, female: 0, activeVillages: 0, activeGroups: 0, averageAge: 0 }, villages: [], groups: [], ages: [] };
const money = new Intl.NumberFormat("id-ID");

function attendanceDate(date: string) { return new Date(date.endsWith("Z") || /[+-]\d{2}:?\d{2}$/.test(date) ? date : `${date.replace(" ", "T")}Z`); }
function formatDate(date: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Jakarta" }).format(attendanceDate(date)); }
function formatTime(date: string) { return new Intl.DateTimeFormat("id-ID", { hour: "2-digit", minute: "2-digit", timeZone: "Asia/Jakarta" }).format(attendanceDate(date)); }
function localDateTimeValue(date: string) { return new Date(attendanceDate(date).getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 16); }

export function DashboardView() {
  const [stats, setStats] = useState<Stats>(emptyStats);
  const [eventId, setEventId] = useState("all");
  const [villageId, setVillageId] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [dateFilterReady, setDateFilterReady] = useState(false);
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
  const [villages, setVillages] = useState<VillageOption[]>([]);
  const [groups, setGroups] = useState<GroupOption[]>([]);
  const [editingPerson, setEditingPerson] = useState<Person | null>(null);
  const [editForm, setEditForm] = useState<AttendanceForm>({ fullName: "", villageId: "", groupId: "", age: "", gender: "unknown", occupation: "", createdAt: "" });
  const [editOptionsLoading, setEditOptionsLoading] = useState(false);
  const [actionBusy, setActionBusy] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [editError, setEditError] = useState("");

  useEffect(() => {
    const now = new Date();
    const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
    setFrom(today);
    setTo(today);
    setDateFilterReady(true);
  }, []);

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
      setLastUpdated(new Date()); setError("");
    } catch (e) { setError(e instanceof Error ? e.message : "Data belum dapat dimuat."); }
    finally { setLoading(false); }
  }, [eventId, from, to]);

  const loadPeople = useCallback(async () => {
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

  useEffect(() => { if (!dateFilterReady) return; void loadStats(); const timer = window.setInterval(() => void loadStats(), 30_000); return () => window.clearInterval(timer); }, [dateFilterReady, loadStats]);
  useEffect(() => { if (dateFilterReady) void loadPeople(); }, [dateFilterReady, loadPeople]);
  useEffect(() => { if (!dateFilterReady) return; const timer = window.setInterval(() => void loadPeople(), 30_000); return () => window.clearInterval(timer); }, [dateFilterReady, loadPeople]);

  const visibleGroups = useMemo(() => stats.groups.filter((group) => villageId === "all" || group.villageId === Number(villageId)), [stats.groups, villageId]);
  const visibleGroupTotal = useMemo(() => visibleGroups.reduce((sum, group) => sum + group.total, 0), [visibleGroups]);
  const visibleGroupPercentages = useMemo(() => visibleGroups.map((group) => ({ ...group, percentage: visibleGroupTotal ? Number(((group.total / visibleGroupTotal) * 100).toFixed(1)) : 0 })), [visibleGroups, visibleGroupTotal]);
  const exportUrl = useMemo(() => { const params = new URLSearchParams({ eventId }); if (from) params.set("from", from); if (to) params.set("to", to); return `/api/admin/attendances/export?${params}`; }, [eventId, from, to]);
  const changeSort = (column: string) => { if (sort === column) setDirection((value) => value === "asc" ? "desc" : "asc"); else { setSort(column); setDirection("asc"); } setPage(1); };
  const applySearch = (event: React.FormEvent) => { event.preventDefault(); setSearch(searchInput.trim()); setPage(1); };

  const openEdit = async (person: Person) => {
    setEditingPerson(person);
    setEditForm({ fullName: person.fullName, villageId: String(person.villageId), groupId: String(person.groupId), age: String(person.age), gender: person.gender, occupation: person.occupation, createdAt: localDateTimeValue(person.createdAt) });
    setEditError("");
    if (villages.length && groups.length) return;
    setEditOptionsLoading(true);
    try {
      const [villageResponse, groupResponse] = await Promise.all([
        fetch("/api/admin/villages", { cache: "no-store" }),
        fetch("/api/admin/groups", { cache: "no-store" }),
      ]);
      if (villageResponse.status === 401 || groupResponse.status === 401) { window.location.assign("/admin/login"); return; }
      const [villageData, groupData] = await Promise.all([
        safeJson<{ villages?: VillageOption[]; error?: string }>(villageResponse),
        safeJson<{ groups?: GroupOption[]; error?: string }>(groupResponse),
      ]);
      if (!villageResponse.ok || !groupResponse.ok) throw new Error(villageData.error ?? groupData.error ?? "Pilihan desa dan kelompok belum dapat dimuat.");
      setVillages(villageData.villages ?? []);
      setGroups(groupData.groups ?? []);
    } catch (e) {
      setEditError(e instanceof Error ? e.message : "Pilihan desa dan kelompok belum dapat dimuat.");
    } finally {
      setEditOptionsLoading(false);
    }
  };

  const saveAttendance = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!editingPerson) return;
    setActionBusy(true); setEditError("");
    const response = await fetch(`/api/admin/attendances/${editingPerson.id}`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...editForm, villageId: Number(editForm.villageId), groupId: Number(editForm.groupId), age: Number(editForm.age) }),
    }).catch(() => null);
    const data = await safeJson<{ error?: string }>(response);
    setActionBusy(false);
    if (response?.status === 401) { window.location.assign("/admin/login"); return; }
    if (!response?.ok) { setEditError(data.error ?? "Perubahan belum dapat disimpan."); return; }
    setEditingPerson(null);
    void loadPeople(); void loadStats();
  };

  const deleteAttendance = async (person: Person) => {
    if (!window.confirm(`Hapus data kehadiran ${person.fullName}? Data ini tidak dapat dipulihkan.`)) return;
    setDeletingId(person.id); setError("");
    const response = await fetch(`/api/admin/attendances/${person.id}`, { method: "DELETE" }).catch(() => null);
    const data = await safeJson<{ error?: string }>(response);
    setDeletingId(null);
    if (response?.status === 401) { window.location.assign("/admin/login"); return; }
    if (!response?.ok) { setError(data.error ?? "Data kehadiran belum dapat dihapus."); return; }
    if (people.length === 1 && page > 1) setPage((value) => Math.max(1, value - 1));
    else void loadPeople();
    void loadStats();
  };

  const statCards = [
    { label: "Total hadir", value: money.format(stats.summary.total), detail: "peserta tercatat", icon: UserRoundCheck, tint: "#e8f0df" },
    { label: "Laki-laki hadir", value: money.format(stats.summary.male), detail: "peserta laki-laki", icon: UserRound, tint: "#e9efee" },
    { label: "Perempuan hadir", value: money.format(stats.summary.female), detail: "peserta perempuan", icon: UsersRound, tint: "#f3eadf" },
    { label: "Desa terwakili", value: `${stats.summary.activeVillages} / 4`, detail: "wilayah hadir", icon: UsersRound, tint: "#e9efee" },
    { label: "Kelompok asal", value: money.format(stats.summary.activeGroups), detail: "kelompok terwakili", icon: Activity, tint: "#f3eadf" },
    { label: "Rata-rata umur", value: `${stats.summary.averageAge}`, detail: "tahun", icon: CircleHelp, tint: "#eeece1" },
  ];

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-4 xl:flex-row xl:items-end">
      <div><div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[.18em] text-moss"><span className="h-1.5 w-1.5 rounded-full bg-[#81a269]" /> data kegiatan</div><h1 className="text-[28px] font-bold tracking-[-.045em] sm:text-[32px]">Ringkasan kehadiran</h1><p className="mt-1.5 text-[12px] text-[#879088]">Lihat sebaran jamaah dan pantau daftar hadir.</p></div>
      <div className="flex flex-wrap items-end gap-2">
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Tempat kegiatan</label><div className="relative min-w-[200px]"><select value={eventId} onChange={(e) => { setEventId(e.target.value); setPage(1); }} className="h-10 w-full appearance-none rounded-xl border border-[#e5e6dc] bg-white pl-3 pr-9 text-[11px] font-semibold outline-none focus:border-moss"><option value="all">Semua tempat</option>{stats.events.map((event) => <option key={event.id} value={event.id}>{event.location}</option>)}{!stats.events.length && <option value="">Belum ada kegiatan</option>}</select><ChevronDown size={14} className="pointer-events-none absolute right-3 top-[13px] text-[#859087]" /></div></div>
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Dari tanggal</label><input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-[#e5e6dc] bg-white px-3 text-[11px] outline-none focus:border-moss" /></div>
        <div><label className="mb-1.5 block text-[9px] font-bold uppercase tracking-[.12em] text-[#98a098]">Sampai</label><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="h-10 rounded-xl border border-[#e5e6dc] bg-white px-3 text-[11px] outline-none focus:border-moss" /></div>
        <button onClick={() => { void loadStats(); void loadPeople(); }} title="Perbarui data" className="btn-secondary h-10 w-10 px-0"><RefreshCw size={14} /></button>
      </div>
    </div>
    {error && <div className="mb-5 rounded-xl border border-[#f1d6ce] bg-[#fff6f2] px-4 py-3 text-[12px] text-[#a34f3b]">{error}</div>}
    {!stats.events.length && !loading && <div className="mb-5 flex flex-col justify-between gap-3 rounded-2xl border border-[#e6ddbf] bg-[#fbf6e6] p-5 sm:flex-row sm:items-center"><div><p className="text-[13px] font-bold text-[#665733]">Belum ada kegiatan</p><p className="mt-1 text-[11px] text-[#837a63]">Buat kegiatan dan aktifkan agar peserta bisa mulai mengisi kehadiran.</p></div><a className="btn-primary" href="/admin/kegiatan">Kelola kegiatan <ArrowDown size={14} className="rotate-[-90deg]" /></a></div>}
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">{statCards.map(({ label, value, detail, icon: Icon, tint }) => <div key={label} className="card flex items-center justify-between p-4 sm:p-5"><div><p className="text-[10px] font-semibold text-[#89928b]">{label}</p><p className="mt-2 text-[25px] font-bold tracking-[-.04em]">{loading ? "—" : value}</p><p className="mt-1 text-[9px] text-[#a1a69f]">{detail}</p></div><div className="flex h-10 w-10 items-center justify-center rounded-[14px] text-forest" style={{ background: tint }}><Icon size={18} /></div></div>)}</div>
    <div className="mt-4 grid gap-4 xl:grid-cols-[.9fr_1.1fr]">
      <div className="card p-5 sm:p-6"><div className="flex items-start justify-between gap-3"><div><h2 className="text-[14px] font-bold">Kehadiran per desa</h2><p className="mt-1 text-[10px] text-[#959c94]">Sebaran jamaah di empat wilayah.</p></div><span className="rounded-lg bg-[#f0f3e9] px-2 py-1 text-[9px] font-bold text-forest">{stats.summary.activeVillages} DESA</span></div><div className="mt-4 h-[240px] w-full">{stats.summary.total ? <ResponsiveContainer width="100%" height="100%"><PieChart><Pie data={stats.villages} dataKey="total" nameKey="name" innerRadius={64} outerRadius={89} paddingAngle={3} stroke="none">{stats.villages.map((entry, index) => <Cell key={entry.id} fill={VILLAGE_COLORS[index % VILLAGE_COLORS.length]} />)}</Pie><Tooltip formatter={(value) => [`${value} jamaah`, "Hadir"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /></PieChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada data kehadiran.</div>}</div><div className="mt-1 grid grid-cols-2 gap-x-4 gap-y-2">{stats.villages.map((village, index) => <div key={village.id} className="flex items-center justify-between gap-2"><span className="flex items-center gap-2 text-[10px] text-[#718078]"><i className="h-2 w-2 rounded-full" style={{ background: VILLAGE_COLORS[index % VILLAGE_COLORS.length] }} />{village.name}</span><strong className="text-[10px]">{village.total}</strong></div>)}</div></div>
      <div className="card p-5 sm:p-6">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-start">
          <div><h2 className="text-[14px] font-bold">Kehadiran per kelompok</h2><p className="mt-1 text-[10px] text-[#959c94]">Persentase peserta dari total kehadiran pada filter ini.</p></div>
          <div className="relative"><Filter size={12} className="pointer-events-none absolute left-3 top-[12px] text-[#88938a]" /><select value={villageId} onChange={(e) => setVillageId(e.target.value)} className="h-9 appearance-none rounded-xl border border-[#e6e7dd] bg-white pl-8 pr-8 text-[10px] font-semibold outline-none"><option value="all">Semua desa</option>{stats.villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select><ChevronDown size={12} className="pointer-events-none absolute right-3 top-[13px] text-[#89948b]" /></div>
        </div>
        <div className="mt-5 max-h-[480px] overflow-y-auto pr-1">
          <div style={{ height: `${Math.max(280, visibleGroups.length * 28)}px` }}>
            {visibleGroupPercentages.length && visibleGroupTotal ? <ResponsiveContainer width="100%" height="100%"><BarChart data={visibleGroupPercentages} layout="vertical" margin={{ top: 4, right: 12, bottom: 4, left: 4 }}><CartesianGrid stroke="#edf0e8" horizontal={false} /><XAxis type="number" domain={[0, 100]} allowDecimals={false} tickFormatter={(value: number) => `${value}%`} tick={{ fontSize: 9, fill: "#9ba199" }} axisLine={false} tickLine={false} /><YAxis type="category" dataKey="name" width={108} tick={{ fontSize: 9, fill: "#869087" }} axisLine={false} tickLine={false} interval={0} /><Tooltip cursor={{ fill: "#f3f5ed" }} formatter={(value) => [`${Number(value).toLocaleString("id-ID", { maximumFractionDigits: 1 })}%`, "Persentase"]} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /><Bar dataKey="percentage" name="Persentase" radius={[0, 6, 6, 0]} maxBarSize={18}>{visibleGroupPercentages.map((group) => { const index = stats.groups.findIndex((item) => item.id === group.id); return <Cell key={group.id} fill={GROUP_COLORS[index % GROUP_COLORS.length]} />; })}</Bar></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada kelompok hadir.</div>}
          </div>
        </div>
      </div>
    </div>
    <div className="card mt-4 p-5 sm:p-6"><div className="flex items-center justify-between"><div><h2 className="text-[14px] font-bold">Kehadiran per rentang umur</h2><p className="mt-1 text-[10px] text-[#959c94]">Komposisi umur jamaah yang hadir.</p></div><span className="rounded-lg bg-[#f7f1e9] px-2 py-1 text-[9px] font-bold text-[#a06b4e]">USIA</span></div><div className="mt-4 h-[200px]">{stats.summary.total ? <ResponsiveContainer width="100%" height="100%"><BarChart data={stats.ages} margin={{ top: 8, right: 12, bottom: 0, left: -20 }}><CartesianGrid stroke="#edf0e8" vertical={false} /><XAxis dataKey="label" tick={{ fontSize: 10, fill: "#869087" }} axisLine={false} tickLine={false} /><YAxis allowDecimals={false} tick={{ fontSize: 9, fill: "#9ba199" }} axisLine={false} tickLine={false} /><Tooltip cursor={{ fill: "#f3f5ed" }} contentStyle={{ borderRadius: 12, border: "1px solid #e8e8df", fontSize: 11 }} /><Bar dataKey="total" name="Jamaah" fill="#d48b68" radius={[6, 6, 0, 0]} maxBarSize={44} /></BarChart></ResponsiveContainer> : <div className="flex h-full items-center justify-center text-[11px] text-[#9ba198]">Belum ada data umur.</div>}</div></div>
    <div className="card mt-4 overflow-hidden">
      <div className="flex flex-col justify-between gap-4 p-5 sm:flex-row sm:items-center sm:px-6"><div><h2 className="text-[14px] font-bold">Daftar hadir</h2><p className="mt-1 text-[10px] text-[#959c94]">{total ? `${money.format(total)} peserta terdaftar` : "Data peserta dari semua kegiatan."}{lastUpdated && <span> · Diperbarui {formatTime(lastUpdated.toISOString())}</span>}</p></div><div className="flex flex-wrap items-center gap-2"><form onSubmit={applySearch} className="relative"><Search size={14} className="absolute left-3 top-[12px] text-[#929a92]" /><input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Cari nama / pekerjaan" className="h-9 w-[190px] rounded-xl border border-[#e5e6dc] bg-white pl-9 pr-3 text-[10px] outline-none focus:border-moss" /></form><a href={exportUrl} className="btn-secondary h-9"><ArrowDownToLine size={14} /> Ekspor CSV</a></div></div>
      <div className="admin-scroll overflow-x-auto"><table className="w-full min-w-[1040px] border-collapse text-left"><thead><tr className="border-y border-[#eeeee7] bg-[#fbfbf8] text-[9px] font-bold uppercase tracking-[.1em] text-[#939b93]"><th className="px-6 py-3"><button onClick={() => changeSort("fullName")} className="flex items-center gap-1">Nama {sort === "fullName" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th><th className="px-4 py-3">Jenis kelamin</th><th className="px-4 py-3">Desa</th><th className="px-4 py-3">Kelompok asal</th><th className="px-4 py-3"><button onClick={() => changeSort("age")} className="flex items-center gap-1">Umur {sort === "age" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th><th className="px-4 py-3">Pekerjaan</th><th className="px-6 py-3"><button onClick={() => changeSort("createdAt")} className="flex items-center gap-1">Waktu absen {sort === "createdAt" && (direction === "asc" ? <ArrowUp size={11} /> : <ArrowDown size={11} />)}</button></th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{tableLoading ? <tr><td colSpan={8} className="px-6 py-12 text-center text-[11px] text-[#9ca39b]">Memuat daftar hadir...</td></tr> : people.length ? people.map((person) => <tr key={person.id} className="border-b border-[#f0f0e9] text-[11px] last:border-0 hover:bg-[#fcfcf9]"><td className="px-6 py-3.5"><div className="font-bold text-ink">{person.fullName}</div><div className="mt-1 text-[9px] font-medium text-[#8b958d]">{person.eventLocation}</div></td><td className="px-4 py-3.5 text-[#748078]">{person.gender === "male" ? "Laki-laki" : person.gender === "female" ? "Perempuan" : "Belum diketahui"}</td><td className="px-4 py-3.5 text-[#748078]">{person.villageName}</td><td className="px-4 py-3.5 text-[#748078]">{person.groupName}</td><td className="px-4 py-3.5 text-[#748078]">{person.age} th</td><td className="px-4 py-3.5 text-[#748078]">{person.occupation}</td><td className="px-6 py-3.5 text-[#879089]">{formatDate(person.createdAt)} · {formatTime(person.createdAt)}</td><td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button onClick={() => void openEdit(person)} aria-label={`Edit ${person.fullName}`} title="Edit peserta" className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[#718078] hover:bg-[#f0f1ea]"><Edit3 size={13} /><span>Ubah</span></button><button onClick={() => void deleteAttendance(person)} disabled={deletingId === person.id} aria-label={`Hapus ${person.fullName}`} title="Hapus peserta" className="flex h-8 items-center gap-1.5 rounded-lg px-2 text-[#ad7568] hover:bg-[#fff2ed] disabled:opacity-50"><Trash2 size={13} /><span>{deletingId === person.id ? "Menghapus" : "Hapus"}</span></button></div></td></tr>) : <tr><td colSpan={8} className="px-6 py-12 text-center"><div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-[#f2f3eb] text-moss"><CalendarDays size={17} /></div><p className="mt-3 text-[11px] font-semibold text-[#7c877e]">Belum ada peserta untuk ditampilkan.</p><p className="mt-1 text-[10px] text-[#a0a69e]">Data hadir akan muncul setelah peserta mengisi formulir.</p></td></tr>}</tbody></table></div>
      <div className="flex items-center justify-between border-t border-[#eeeee7] px-5 py-3 sm:px-6"><span className="text-[10px] text-[#929b93]">Halaman {pages ? page : 0} dari {pages}</span><div className="flex gap-1"><button disabled={page <= 1} onClick={() => setPage((value) => Math.max(1, value - 1))} aria-label="Halaman sebelumnya" className="btn-secondary h-8 w-8 px-0 disabled:opacity-40"><ChevronLeft size={14} /></button><button disabled={page >= pages} onClick={() => setPage((value) => value + 1)} aria-label="Halaman berikutnya" className="btn-secondary h-8 w-8 px-0 disabled:opacity-40"><ChevronRight size={14} /></button></div></div>
    </div>
    <div className="mt-4 flex items-center justify-center gap-2 text-[9px] text-[#a0a69e]"><RefreshCw size={11} /> Data diperbarui otomatis setiap 30 detik.</div>
    {editingPerson && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="attendance-edit-title"><form onSubmit={saveAttendance} className="card max-h-[90vh] w-full max-w-[520px] overflow-y-auto p-6 sm:p-7"><div className="flex items-start justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-moss">perbarui data</div><h2 id="attendance-edit-title" className="mt-2 text-[21px] font-bold">Ubah peserta</h2></div><button type="button" onClick={() => setEditingPerson(null)} aria-label="Tutup dialog" className="rounded-lg p-2 text-[#89938b] hover:bg-[#f1f2eb]"><X size={17} /></button></div>
      <div className="mt-6 space-y-4"><div><label className="field-label" htmlFor="edit-full-name">Nama lengkap</label><input id="edit-full-name" autoFocus required minLength={3} maxLength={100} className="input-field" value={editForm.fullName} onChange={(e) => setEditForm({ ...editForm, fullName: e.target.value })} /></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="edit-gender">Jenis kelamin</label><select id="edit-gender" className="input-field" value={editForm.gender} onChange={(e) => setEditForm({ ...editForm, gender: e.target.value as Person["gender"] })}><option value="male">Laki-laki</option><option value="female">Perempuan</option><option value="unknown">Belum diketahui</option></select></div><div><label className="field-label" htmlFor="edit-age">Umur</label><input id="edit-age" type="number" required min={5} max={100} className="input-field" value={editForm.age} onChange={(e) => setEditForm({ ...editForm, age: e.target.value })} /></div></div>
        <div className="grid gap-4 sm:grid-cols-2"><div><label className="field-label" htmlFor="edit-village">Desa</label><select id="edit-village" required className="input-field" value={editForm.villageId} disabled={editOptionsLoading} onChange={(e) => setEditForm({ ...editForm, villageId: e.target.value, groupId: "" })}><option value="">Pilih desa</option>{villages.map((village) => <option key={village.id} value={village.id}>{village.name}{village.isActive ? "" : " · nonaktif"}</option>)}</select></div><div><label className="field-label" htmlFor="edit-group">Kelompok asal</label><select id="edit-group" required className="input-field" value={editForm.groupId} disabled={editOptionsLoading || !editForm.villageId} onChange={(e) => setEditForm({ ...editForm, groupId: e.target.value })}><option value="">Pilih kelompok</option>{groups.filter((group) => group.villageId === Number(editForm.villageId)).map((group) => <option key={group.id} value={group.id}>{group.name}{group.isActive ? "" : " · nonaktif"}</option>)}</select></div></div>
        <div><label className="field-label" htmlFor="edit-occupation">Pekerjaan</label><input id="edit-occupation" required maxLength={100} className="input-field" value={editForm.occupation} onChange={(e) => setEditForm({ ...editForm, occupation: e.target.value })} /></div>
        <div><label className="field-label" htmlFor="edit-created-at">Waktu absen</label><input id="edit-created-at" type="datetime-local" required className="input-field" value={editForm.createdAt} onChange={(e) => setEditForm({ ...editForm, createdAt: e.target.value })} /></div>
      </div>
      {editOptionsLoading && <p className="mt-4 flex items-center gap-2 text-[11px] text-[#89938b]"><LoaderCircle size={14} className="spin" /> Memuat pilihan desa dan kelompok...</p>}
      {editError && <p role="alert" className="mt-4 rounded-xl bg-[#fff3ef] px-3 py-2 text-[11px] text-[#a5523e]">{editError}</p>}
      <div className="mt-7 flex justify-end gap-2 border-t border-[#efefe8] pt-4"><button type="button" onClick={() => setEditingPerson(null)} className="btn-secondary">Batal</button><button type="submit" disabled={actionBusy || editOptionsLoading} className="btn-primary min-h-10">{actionBusy ? <><LoaderCircle size={14} className="spin" /> Menyimpan...</> : "Simpan perubahan"}</button></div>
    </form></div>}
  </div>;
}
