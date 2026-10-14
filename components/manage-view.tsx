"use client";

import { ArrowRight, CalendarDays, Check, ChevronDown, CirclePlus, Clock3, Edit3, Layers3, LoaderCircle, MapPin, MoreHorizontal, Power, Trash2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { safeJson } from "@/components/api-json";

type EventRow = { id: number; name: string; eventDate: string; eventTime: string; location: string; description: string | null; status: "draft" | "active" | "finished"; attendanceCount: number };
type Village = { id: number; name: string; isActive: boolean; groupCount: number; attendanceCount: number };
type GroupRow = { id: number; villageId: number; villageName: string; name: string; isActive: boolean; attendanceCount: number };
type Tab = "events" | "villages" | "groups";

const blankEvent = { name: "", eventDate: "", eventTime: "", location: "", description: "", status: "draft" as const };
function dateText(value: string) { return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T12:00:00+07:00`)); }
function timeText(value: string) { return value?.slice(0, 5) || "—"; }

export function ManageView() {
  const [tab, setTab] = useState<Tab>("events");
  const [events, setEvents] = useState<EventRow[]>([]);
  const [villages, setVillages] = useState<Village[]>([]);
  const [groups, setGroups] = useState<GroupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [modal, setModal] = useState<"event" | "village" | "group" | null>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [eventForm, setEventForm] = useState<{ name: string; eventDate: string; eventTime: string; location: string; description: string; status: EventRow["status"] }>({ ...blankEvent });
  const [villageName, setVillageName] = useState("");
  const [groupForm, setGroupForm] = useState({ name: "", villageId: "" });

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [eventResponse, villageResponse, groupResponse] = await Promise.all([fetch("/api/admin/events", { cache: "no-store" }), fetch("/api/admin/villages", { cache: "no-store" }), fetch("/api/admin/groups", { cache: "no-store" })]);
      if ([eventResponse, villageResponse, groupResponse].some((response) => response.status === 401)) { window.location.assign("/admin/login"); return; }
      const [eventData, villageData, groupData] = await Promise.all([safeJson<{ events?: EventRow[] }>(eventResponse), safeJson<{ villages?: Village[] }>(villageResponse), safeJson<{ groups?: GroupRow[] }>(groupResponse)]);
      setEvents(eventData.events ?? []); setVillages(villageData.villages ?? []); setGroups(groupData.groups ?? []);
    } catch { setError("Data belum dapat dimuat. Periksa koneksi dan konfigurasi database."); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { void load(); }, [load]);

  const notify = (message: string) => { setNotice(message); window.setTimeout(() => setNotice(""), 4000); };
  const fail = (message: string) => setError(message);
  const openEvent = (event?: EventRow) => { setEditingId(event?.id ?? null); setEventForm(event ? { name: event.name, eventDate: event.eventDate, eventTime: timeText(event.eventTime), location: event.location, description: event.description ?? "", status: event.status } : { ...blankEvent }); setModal("event"); setError(""); };
  const openVillage = (village?: Village) => { setEditingId(village?.id ?? null); setVillageName(village?.name ?? ""); setModal("village"); setError(""); };
  const openGroup = (group?: GroupRow) => { setEditingId(group?.id ?? null); setGroupForm(group ? { name: group.name, villageId: String(group.villageId) } : { name: "", villageId: String(villages.find((village) => village.isActive)?.id ?? "") }); setModal("group"); setError(""); };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError(""); setBusy(true);
    let path = ""; let method = editingId ? "PATCH" : "POST"; let body: object;
    if (modal === "event") { path = editingId ? `/api/admin/events/${editingId}` : "/api/admin/events"; body = eventForm; }
    else if (modal === "village") { path = editingId ? `/api/admin/villages/${editingId}` : "/api/admin/villages"; body = { name: villageName }; }
    else { path = editingId ? `/api/admin/groups/${editingId}` : "/api/admin/groups"; body = { name: groupForm.name, villageId: Number(groupForm.villageId) }; }
    const response = await fetch(path, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => null);
    const data = await safeJson(response); setBusy(false);
    if (!response?.ok) { fail(data?.error ?? "Perubahan belum dapat disimpan."); return; }
    setModal(null); notify(editingId ? "Perubahan berhasil disimpan." : "Data baru berhasil ditambahkan."); await load();
  };

  const remove = async (kind: "events" | "villages" | "groups", item: EventRow | Village | GroupRow) => {
    const name = "name" in item ? item.name : "";
    if (!window.confirm(`Hapus atau nonaktifkan “${name}”?`)) return;
    const response = await fetch(`/api/admin/${kind}/${item.id}`, { method: "DELETE" }).catch(() => null);
    const data = await safeJson<{ error?: string; message?: string; deactivated?: boolean }>(response);
    if (!response?.ok) { fail(data?.error ?? "Data belum dapat dihapus."); return; }
    notify(data.deactivated ? data.message ?? "Data berhasil dinonaktifkan." : "Data berhasil dihapus."); await load();
  };

  const toggleActive = async (kind: "villages" | "groups", item: Village | GroupRow) => {
    const response = await fetch(`/api/admin/${kind}/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ isActive: !item.isActive }) }).catch(() => null);
    const data = await safeJson(response);
    if (!response?.ok) { fail(data?.error ?? "Status belum dapat diubah."); return; }
    notify(item.isActive ? "Data dinonaktifkan." : "Data diaktifkan kembali."); await load();
  };

  const setEventStatus = async (item: EventRow, status: EventRow["status"]) => {
    const response = await fetch(`/api/admin/events/${item.id}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ name: item.name, eventDate: item.eventDate, eventTime: timeText(item.eventTime), location: item.location, description: item.description, status }) }).catch(() => null);
    const data = await safeJson(response);
    if (!response?.ok) { fail(data?.error ?? "Status kegiatan belum dapat diubah."); return; }
    notify(status === "active" ? "Kegiatan aktif. Form absensi peserta kini terbuka." : `Status kegiatan diubah menjadi ${status === "finished" ? "selesai" : "draft"}.`); await load();
  };

  const tabs = [{ id: "events" as const, label: "Kegiatan", icon: CalendarDays, count: events.length }, { id: "villages" as const, label: "Desa", icon: UsersRound, count: villages.filter((v) => v.isActive).length }, { id: "groups" as const, label: "Kelompok", icon: Layers3, count: groups.filter((g) => g.isActive).length }];

  return <div>
    <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-end"><div><div className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-moss">operasional</div><h1 className="text-[28px] font-bold tracking-[-.045em] sm:text-[32px]">Kelola kegiatan</h1><p className="mt-1.5 text-[12px] text-[#879088]">Atur jadwal, wilayah, dan kelompok asal jamaah.</p></div><div className="flex items-center gap-2 rounded-full border border-[#e6e7dc] bg-white px-3 py-2 text-[10px] font-semibold text-[#78837a]"><span className="h-1.5 w-1.5 rounded-full bg-[#80a46a]" /> {events.filter((event) => event.status === "active").length ? "Ada kegiatan aktif" : "Belum ada kegiatan aktif"}</div></div>
    <div className="mb-5 flex gap-1 border-b border-[#e7e8de]">{tabs.map(({ id, label, icon: Icon, count }) => <button key={id} onClick={() => { setTab(id); setError(""); }} className={`relative flex items-center gap-2 px-4 py-3 text-[11px] font-semibold transition ${tab === id ? "text-forest" : "text-[#879188] hover:text-forest"}`}><Icon size={14} />{label}<span className={`rounded-full px-1.5 py-0.5 text-[9px] ${tab === id ? "bg-[#eaf0df] text-forest" : "bg-[#eeeeea] text-[#8b938a]"}`}>{count}</span>{tab === id && <span className="absolute inset-x-2 bottom-[-1px] h-[2px] rounded bg-forest" />}</button>)}</div>
    {notice && <div role="status" className="mb-4 flex items-center gap-2 rounded-xl border border-[#dce6d1] bg-[#f0f4e8] px-4 py-3 text-[11px] text-forest"><Check size={14} />{notice}</div>}
    {error && <div role="alert" className="mb-4 rounded-xl border border-[#f1d6ce] bg-[#fff6f2] px-4 py-3 text-[11px] text-[#a34f3b]">{error}</div>}
    {loading ? <div className="card flex h-48 items-center justify-center gap-2 text-[12px] text-[#8f988f]"><LoaderCircle size={16} className="spin" /> Memuat data...</div> : <>
      {tab === "events" && <div>
        <div className="mb-4 flex items-center justify-between"><p className="text-[11px] text-[#8b958d]">Kegiatan yang sudah dan sedang disiapkan.</p><button onClick={() => openEvent()} className="btn-primary min-h-10"><CirclePlus size={15} /> Tambah kegiatan</button></div>
        {events.length ? <div className="grid gap-3 xl:grid-cols-2">{events.map((event) => <article key={event.id} className={`card p-5 sm:p-6 ${event.status === "active" ? "border-[#bfd0b2]" : ""}`}><div className="flex items-start justify-between gap-3"><div><span className={`inline-flex rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[.1em] ${event.status === "active" ? "bg-[#e8f1de] text-[#477349]" : event.status === "finished" ? "bg-[#efeee9] text-[#83877c]" : "bg-[#faf0df] text-[#a07a43]"}`}>{event.status === "active" ? "Aktif · absensi dibuka" : event.status === "finished" ? "Selesai" : "Draft"}</span><h2 className="mt-3 text-[18px] font-bold tracking-[-.03em]">{event.name}</h2><div className="mt-2 flex flex-wrap gap-x-4 gap-y-2 text-[10px] text-[#838e85]"><span className="flex items-center gap-1.5"><CalendarDays size={12} className="text-moss" />{dateText(event.eventDate)}</span><span className="flex items-center gap-1.5"><Clock3 size={12} className="text-moss" />{timeText(event.eventTime)} WIB</span><span className="flex items-center gap-1.5"><MapPin size={12} className="text-moss" />{event.location}</span></div>{event.description && <p className="mt-3 line-clamp-2 text-[11px] leading-5 text-[#8b948c]">{event.description}</p>}</div><button className="rounded-lg p-2 text-[#9aa197] hover:bg-[#f0f1ea]" onClick={() => openEvent(event)} title="Edit kegiatan"><Edit3 size={15} /></button></div><div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-[#eeeee7] pt-4"><div className="flex items-center gap-1.5 text-[10px] text-[#7d897f]"><UsersRound size={13} className="text-moss" /><strong className="text-ink">{event.attendanceCount}</strong> peserta hadir</div><div className="flex flex-wrap items-center gap-2">{event.status !== "active" && <button onClick={() => setEventStatus(event, "active")} className="btn-secondary h-8 px-3"><Power size={12} /> Aktifkan</button>}{event.status === "active" && <button onClick={() => setEventStatus(event, "finished")} className="btn-secondary h-8 px-3">Tutup kegiatan</button>}<Link href={`/admin/kegiatan/${event.id}/pembagian`} className="btn-secondary h-8 px-3"><Layers3 size={12} /> Bagi kelompok</Link><button onClick={() => remove("events", event)} title="Hapus kegiatan" className="flex h-8 w-8 items-center justify-center rounded-xl border border-[#ece8e3] bg-white text-[#aa7668] hover:bg-[#fff4ef]"><Trash2 size={13} /></button></div></div></article>)}</div> : <EmptyState title="Belum ada kegiatan" description="Buat kegiatan pertama untuk membuka absensi jamaah." action="Tambah kegiatan" onAction={() => openEvent()} />}
      </div>}
      {tab === "villages" && <div><div className="mb-4 flex items-center justify-between"><p className="text-[11px] text-[#8b958d]">Wilayah yang dapat dipilih oleh peserta.</p><button onClick={() => openVillage()} className="btn-primary min-h-10"><CirclePlus size={15} /> Tambah desa</button></div><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{villages.map((village) => <div key={village.id} className={`card p-5 ${!village.isActive ? "opacity-65" : ""}`}><div className="flex items-start justify-between"><div className="flex h-10 w-10 items-center justify-center rounded-[14px] bg-[#eaf0e1] text-forest"><UsersRound size={18} /></div><button onClick={() => toggleActive("villages", village)} className={`rounded-full px-2.5 py-1 text-[9px] font-bold ${village.isActive ? "bg-[#e8f1de] text-[#477349]" : "bg-[#efeee9] text-[#85877f]"}`}>{village.isActive ? "Aktif" : "Nonaktif"}</button></div><h2 className="mt-4 text-[17px] font-bold">{village.name}</h2><div className="mt-2 flex gap-4 text-[10px] text-[#89938b]"><span>{village.groupCount} kelompok</span><span>{village.attendanceCount} riwayat hadir</span></div><div className="mt-4 flex gap-2 border-t border-[#efefe8] pt-3"><button onClick={() => openVillage(village)} className="btn-secondary h-8 flex-1"><Edit3 size={12} /> Ubah nama</button><button onClick={() => remove("villages", village)} title="Hapus atau nonaktifkan" className="btn-secondary h-8 w-9 px-0 text-[#a86f61]"><Trash2 size={13} /></button></div></div>)}</div>{!villages.length && <EmptyState title="Tambahkan desa" description="Data awal Bandara, Cengkareng, Kalideres, dan Cipondoh akan tersedia setelah setup database." action="Tambah desa" onAction={() => openVillage()} />}</div>}
      {tab === "groups" && <div><div className="mb-4 flex items-center justify-between"><p className="text-[11px] text-[#8b958d]">Kelompok asal untuk formulir absensi.</p><button onClick={() => openGroup()} disabled={!villages.some((v) => v.isActive)} className="btn-primary min-h-10 disabled:opacity-50"><CirclePlus size={15} /> Tambah kelompok</button></div><div className="card overflow-hidden"><div className="admin-scroll overflow-x-auto"><table className="w-full min-w-[620px] text-left"><thead><tr className="border-b border-[#eeeee7] bg-[#fbfbf8] text-[9px] font-bold uppercase tracking-[.1em] text-[#939b93]"><th className="px-5 py-3">Nama kelompok</th><th className="px-4 py-3">Desa</th><th className="px-4 py-3">Peserta tercatat</th><th className="px-4 py-3">Status</th><th className="px-5 py-3 text-right">Aksi</th></tr></thead><tbody>{groups.map((group) => <tr key={group.id} className="border-b border-[#f0f0e9] text-[11px] last:border-0"><td className="px-5 py-3.5 font-bold">{group.name}</td><td className="px-4 py-3.5 text-[#758078]">{group.villageName}</td><td className="px-4 py-3.5 text-[#758078]">{group.attendanceCount}</td><td className="px-4 py-3.5"><span className={`rounded-full px-2 py-1 text-[9px] font-bold ${group.isActive ? "bg-[#e8f1de] text-[#477349]" : "bg-[#efeee9] text-[#85877f]"}`}>{group.isActive ? "Aktif" : "Nonaktif"}</span></td><td className="px-5 py-3.5"><div className="flex justify-end gap-1"><button onClick={() => openGroup(group)} title="Ubah" className="rounded-lg p-2 text-[#88938a] hover:bg-[#f0f1ea]"><Edit3 size={14} /></button><button onClick={() => toggleActive("groups", group)} title={group.isActive ? "Nonaktifkan" : "Aktifkan"} className="rounded-lg p-2 text-[#88938a] hover:bg-[#f0f1ea]"><Power size={14} /></button><button onClick={() => remove("groups", group)} title="Hapus" className="rounded-lg p-2 text-[#ad7568] hover:bg-[#fff2ed]"><Trash2 size={14} /></button></div></td></tr>)}{!groups.length && <tr><td colSpan={5} className="py-12 text-center text-[11px] text-[#929a92]">Belum ada kelompok. Tambahkan kelompok untuk setiap desa.</td></tr>}</tbody></table></div></div></div>}
    </>}

    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true"><form onSubmit={submit} className="card max-h-[90vh] w-full max-w-[510px] overflow-y-auto p-6 sm:p-7"><div className="flex items-start justify-between"><div><div className="text-[9px] font-bold uppercase tracking-[.18em] text-moss">{editingId ? "perbarui data" : "data baru"}</div><h2 className="mt-2 text-[21px] font-bold">{modal === "event" ? `${editingId ? "Ubah" : "Tambah"} kegiatan` : modal === "village" ? `${editingId ? "Ubah" : "Tambah"} desa` : `${editingId ? "Ubah" : "Tambah"} kelompok`}</h2></div><button type="button" onClick={() => setModal(null)} aria-label="Tutup dialog" className="rounded-lg p-2 text-[#89938b] hover:bg-[#f1f2eb]"><X size={17} /></button></div>
      {modal === "event" && <div className="mt-6 space-y-4"><div><label className="field-label">Nama kegiatan</label><input required minLength={3} maxLength={120} className="input-field" placeholder="Contoh: Pengajian Akbar Bulanan" value={eventForm.name} onChange={(e) => setEventForm({ ...eventForm, name: e.target.value })} /></div><div className="grid grid-cols-2 gap-3"><div><label className="field-label">Tanggal</label><input required type="date" className="input-field" value={eventForm.eventDate} onChange={(e) => setEventForm({ ...eventForm, eventDate: e.target.value })} /></div><div><label className="field-label">Waktu</label><input required type="time" className="input-field" value={eventForm.eventTime} onChange={(e) => setEventForm({ ...eventForm, eventTime: e.target.value })} /></div></div><div><label className="field-label">Lokasi</label><input required maxLength={160} className="input-field" placeholder="Contoh: Aula Masjid Al-Ikhlas" value={eventForm.location} onChange={(e) => setEventForm({ ...eventForm, location: e.target.value })} /></div><div><label className="field-label">Deskripsi <span className="field-hint">opsional</span></label><textarea maxLength={500} className="input-field input-area" placeholder="Informasi singkat untuk peserta" value={eventForm.description} onChange={(e) => setEventForm({ ...eventForm, description: e.target.value })} /></div><div><label className="field-label">Status</label><div className="relative"><select className="input-field appearance-none pr-10" value={eventForm.status} onChange={(e) => setEventForm({ ...eventForm, status: e.target.value as EventRow["status"] })}><option value="draft">Draft</option><option value="active">Aktif · buka absensi</option><option value="finished">Selesai</option></select><ChevronDown size={14} className="pointer-events-none absolute right-4 top-[18px] text-[#859087]" /></div><p className="mt-2 text-[10px] leading-4 text-[#929a92]">Hanya satu kegiatan dapat aktif pada satu waktu.</p></div></div>}
      {modal === "village" && <div className="mt-6"><label className="field-label">Nama desa</label><input autoFocus required minLength={2} maxLength={80} className="input-field" placeholder="Nama desa" value={villageName} onChange={(e) => setVillageName(e.target.value)} /></div>}
      {modal === "group" && <div className="mt-6 space-y-4"><div><label className="field-label">Nama kelompok</label><input autoFocus required maxLength={80} className="input-field" placeholder="Contoh: Al-Hikmah" value={groupForm.name} onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })} /></div><div><label className="field-label">Desa</label><div className="relative"><select required className="input-field appearance-none pr-10" value={groupForm.villageId} onChange={(e) => setGroupForm({ ...groupForm, villageId: e.target.value })}><option value="">Pilih desa</option>{villages.filter((v) => v.isActive || v.id === Number(groupForm.villageId)).map((village) => <option key={village.id} value={village.id}>{village.name}{!village.isActive ? " · nonaktif" : ""}</option>)}</select><ChevronDown size={14} className="pointer-events-none absolute right-4 top-[18px] text-[#859087]" /></div></div></div>}
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff3ef] px-3 py-2 text-[11px] text-[#a5523e]">{error}</p>}
      <div className="mt-7 flex justify-end gap-2 border-t border-[#efefe8] pt-4"><button type="button" onClick={() => setModal(null)} className="btn-secondary">Batal</button><button type="submit" disabled={busy} className="btn-primary min-h-10">{busy ? <><LoaderCircle size={14} className="spin" /> Menyimpan...</> : <>{editingId ? "Simpan perubahan" : "Simpan"} <ArrowRight size={14} /></>}</button></div>
    </form></div>}
  </div>;
}

function EmptyState({ title, description, action, onAction }: { title: string; description: string; action: string; onAction: () => void }) {
  return <div className="card flex flex-col items-center px-6 py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1e4] text-forest"><CalendarDays size={21} /></div><h2 className="mt-4 text-[14px] font-bold">{title}</h2><p className="mt-2 max-w-sm text-[11px] leading-5 text-[#909890]">{description}</p><button onClick={onAction} className="btn-primary mt-5 min-h-10"><CirclePlus size={14} />{action}</button></div>;
}
