"use client";

import { ArrowLeft, ArrowRight, Check, ChevronDown, Download, LoaderCircle, Printer, RotateCcw, Shuffle, UsersRound } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { safeJson } from "@/components/api-json";

type Gender = "male" | "female" | "unknown";
type Member = { id: number; fullName: string; age: number; gender: Gender; occupation: string; villageName: string; groupName: string };
type Team = { name: string; members: Member[] };
type EventData = { id: number; name: string; eventDate: string; eventTime: string; location: string; status: string };

function csv(value: unknown) {
  const raw = String(value ?? "");
  const safe = /^[\t\r ]*[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${safe.replace(/"/g, '""')}"`;
}

function genderLabel(gender: Gender) {
  if (gender === "male") return "Laki-laki";
  if (gender === "female") return "Perempuan";
  return "Belum diketahui";
}

function genderCount(team: Team, gender: Gender) {
  return team.members.filter((person) => person.gender === gender).length;
}

function saveCsv(name: string, groups: Team[]) {
  const lines = [["Kelompok kegiatan", "Nama", "Jenis kelamin", "Desa", "Kelompok asal", "Umur", "Pekerjaan"].map(csv).join(",")];
  groups.forEach((team) => team.members.forEach((person) => lines.push([team.name, person.fullName, genderLabel(person.gender), person.villageName, person.groupName, person.age, person.occupation].map(csv).join(","))));
  const url = URL.createObjectURL(new Blob(["\ufeff", lines.join("\r\n")], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `pembagian-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

export function ShuffleView({ eventId }: { eventId: number }) {
  const [event, setEvent] = useState<EventData | null>(null);
  const [savedGroups, setSavedGroups] = useState<Team[]>([]);
  const [preview, setPreview] = useState<Team[]>([]);
  const [isSaved, setIsSaved] = useState(false);
  const [mode, setMode] = useState<"count" | "size">("count");
  const [value, setValue] = useState("5");
  const [balance, setBalance] = useState(true);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [groupResponse, statsResponse] = await Promise.all([
        fetch(`/api/admin/events/${eventId}/shuffle`, { cache: "no-store" }),
        fetch(`/api/admin/stats?eventId=${eventId}`, { cache: "no-store" }),
      ]);
      if (groupResponse.status === 401) {
        window.location.assign("/admin/login");
        return;
      }
      const [groupData, statsData] = await Promise.all([
        safeJson<{ groups?: Team[]; saved?: boolean }>(groupResponse),
        safeJson<{ event?: EventData | null }>(statsResponse),
      ]);
      setSavedGroups(groupData.groups ?? []);
      setIsSaved(Boolean(groupData.saved));
      setEvent(statsData.event ?? null);
    } catch {
      setError("Data kegiatan belum dapat dimuat.");
    } finally {
      setLoading(false);
    }
  }, [eventId]);

  useEffect(() => { void load(); }, [load]);

  const teams = preview.length ? preview : savedGroups;
  const totalPeople = useMemo(() => teams.reduce((sum, group) => sum + group.members.length, 0), [teams]);
  const unknownCount = useMemo(() => teams.reduce((sum, group) => sum + genderCount(group, "unknown"), 0), [teams]);

  const createPreview = async () => {
    setError("");
    setMessage("");
    if (isSaved && !window.confirm("Hasil saat ini sudah tersimpan. Buat pratinjau baru? Hasil lama tetap ada sampai Anda menyimpan pengganti.")) return;
    setBusy(true);
    const response = await fetch(`/api/admin/events/${eventId}/shuffle`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode, value: Number(value), balanceVillages: balance }),
    }).catch(() => null);
    const data = await safeJson<{ error?: string; groups?: Team[]; participantCount?: number }>(response);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "Pembagian belum dapat dibuat.");
      return;
    }
    setPreview(data.groups ?? []);
    setMessage(`${data.participantCount} peserta berhasil dibagi ke ${data.groups?.length ?? 0} kelompok. Periksa nama dan komposisi sebelum menyimpan.`);
  };

  const renamePreviewGroup = (index: number, name: string) => {
    setPreview((current) => current.map((group, groupIndex) => groupIndex === index ? { ...group, name } : group));
  };

  const save = async () => {
    if (!preview.length) return;
    const groupsToSave = preview.map((group, index) => ({ ...group, name: group.name.trim() || `Kelompok ${index + 1}` }));
    let overwrite = false;
    if (isSaved) {
      if (!window.confirm("Simpan pratinjau ini dan timpa pembagian yang tersimpan sebelumnya?")) return;
      overwrite = true;
    }
    setBusy(true);
    setError("");
    const response = await fetch(`/api/admin/events/${eventId}/shuffle/save`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ overwrite, groups: groupsToSave.map((group) => ({ name: group.name, attendanceIds: group.members.map((member) => member.id) })) }),
    }).catch(() => null);
    const data = await safeJson<{ error?: string }>(response);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "Hasil belum dapat disimpan.");
      return;
    }
    setSavedGroups(groupsToSave);
    setPreview([]);
    setIsSaved(true);
    setMessage("Pembagian berhasil disimpan dan terkunci.");
  };

  const resetSaved = async () => {
    if (!isSaved || !window.confirm("Reset pembagian tersimpan? Hasil pembagian dan pratinjau saat ini akan dihapus, tetapi data peserta tetap aman.")) return;
    setBusy(true);
    setError("");
    setMessage("");
    const response = await fetch(`/api/admin/events/${eventId}/shuffle/save`, { method: "DELETE" }).catch(() => null);
    const data = await safeJson<{ error?: string }>(response);
    setBusy(false);
    if (!response?.ok) {
      setError(data?.error ?? "Pembagian belum dapat direset.");
      return;
    }
    setSavedGroups([]);
    setPreview([]);
    setIsSaved(false);
    setMessage("Pembagian sebelumnya sudah direset. Buat pratinjau baru untuk membagi ulang peserta.");
  };

  return <div>
    <div className="mb-5">
      <Link href="/admin/kegiatan" className="mb-4 inline-flex items-center gap-1.5 text-[10px] font-semibold text-[#879188] hover:text-forest"><ArrowLeft size={13} /> Kembali ke kegiatan</Link>
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div><div className="mb-2 text-[10px] font-bold uppercase tracking-[.18em] text-moss">pembagian peserta</div><h1 className="text-[28px] font-bold tracking-[-.045em]">Kelompok kegiatan</h1><p className="mt-1.5 text-[12px] text-[#879088]">Atur jumlah kelompok dan seimbangkan peserta laki-laki/perempuan.</p></div>
        {event && <span className="rounded-xl border border-[#e4e6db] bg-white px-3 py-2 text-[10px] font-semibold text-[#65736a]">{event.name}</span>}
      </div>
    </div>

    <div className="card p-5 sm:p-6">
      <div className="grid gap-6 xl:grid-cols-[1fr_auto]">
        <div className="grid gap-4 sm:grid-cols-[1fr_1fr_1.2fr]">
          <div>
            <label className="field-label" htmlFor="shuffleMode">Cara menentukan jumlah</label>
            <div className="relative"><select id="shuffleMode" value={mode} onChange={(e) => setMode(e.target.value as "count" | "size")} className="input-field appearance-none pr-10"><option value="count">Jumlah kelompok</option><option value="size">Anggota per kelompok</option></select><ChevronDown size={14} className="pointer-events-none absolute right-4 top-[18px] text-[#859087]" /></div>
          </div>
          <div>
            <label className="field-label" htmlFor="shuffleValue">{mode === "count" ? "Jumlah kelompok" : "Anggota per kelompok"}</label>
            <input id="shuffleValue" type="number" inputMode="numeric" min={1} max={100} step={1} value={value} onChange={(e) => setValue(e.target.value)} className="input-field" />
          </div>
          <div className="flex items-center">
            <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-[#e9e9df] bg-[#fcfcf9] p-3.5"><input type="checkbox" checked={balance} onChange={(e) => setBalance(e.target.checked)} className="mt-0.5 h-4 w-4 rounded border-[#bdc7b5] text-forest focus:ring-forest" /><span><strong className="block text-[11px] text-ink">Sebar desa merata</strong><small className="mt-1 block text-[10px] leading-4 text-[#8c968d]">Jika dipilih, peserta dari desa yang sama juga disebar.</small></span></label>
          </div>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row xl:pb-0.5">{isSaved && <button onClick={resetSaved} disabled={busy || loading} className="btn-secondary min-h-[50px] w-full sm:w-auto">{busy ? <><LoaderCircle size={15} className="spin" /> Memproses...</> : <><RotateCcw size={15} /> Reset pembagian</>}</button>}<button onClick={createPreview} disabled={busy || loading || !value || Number(value) < 1 || Number(value) > 100} className="btn-primary min-h-[50px] w-full sm:w-auto">{busy ? <><LoaderCircle size={15} className="spin" /> Memproses...</> : <><Shuffle size={15} /> {isSaved ? "Acak ulang" : "Buat pembagian"}</>}</button></div>
      </div>
      <p className="mt-4 border-t border-[#efefe8] pt-4 text-[10px] leading-5 text-[#929b92]">Jumlah peserta laki-laki dan perempuan dibuat semerata mungkin di setiap kelompok. Jika jumlahnya habis dibagi, tiap kelompok mendapat jumlah yang sama; jika tidak, selisihnya maksimal satu orang.</p>
    </div>

    {error && <div role="alert" className="mt-4 rounded-xl border border-[#f1d6ce] bg-[#fff6f2] px-4 py-3 text-[11px] text-[#a34f3b]">{error}</div>}
    {message && <div role="status" className="mt-4 flex items-center gap-2 rounded-xl border border-[#dce6d1] bg-[#f0f4e8] px-4 py-3 text-[11px] text-forest"><Check size={14} />{message}</div>}
    {unknownCount > 0 && <div className="mt-4 rounded-xl border border-[#e9e2ce] bg-[#fcf8ec] px-4 py-3 text-[10px] leading-5 text-[#887b59]">{unknownCount} data lama belum memiliki jenis kelamin. Peserta tersebut tetap disebar merata sebagai kategori tersendiri.</div>}

    <div className="mb-4 mt-6 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
      <div><div className="flex items-center gap-2"><h2 className="text-[16px] font-bold">{preview.length ? "Pratinjau pembagian" : isSaved ? "Pembagian tersimpan" : "Belum ada pembagian"}</h2>{isSaved && !preview.length && <span className="rounded-full bg-[#e8f1de] px-2 py-1 text-[9px] font-bold text-[#477349]">TERSIMPAN</span>}</div><p className="mt-1 text-[10px] text-[#959c94]">{totalPeople} jamaah · {teams.length} kelompok</p></div>
      <div className="flex flex-wrap gap-2">{teams.length > 0 && <><button onClick={() => window.print()} className="btn-secondary h-9"><Printer size={14} /> Cetak</button><button onClick={() => saveCsv(event?.name ?? "kegiatan", teams)} className="btn-secondary h-9"><Download size={14} /> Ekspor CSV</button></>}{preview.length > 0 && <button onClick={save} disabled={busy} className="btn-primary min-h-9">{busy ? "Memproses..." : <><Check size={14} /> Simpan hasil</>}</button>}</div>
    </div>

    {loading ? <div className="card flex h-40 items-center justify-center gap-2 text-[11px] text-[#8f988f]"><LoaderCircle size={15} className="spin" /> Memuat hasil pembagian...</div> : teams.length ? <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3 print:grid-cols-2">
      {teams.map((team, index) => <section key={`${team.name}-${index}`} className="card overflow-hidden print:break-inside-avoid">
        <div className="border-b border-[#eeeee7] bg-[#fbfbf8] px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1"><div className="text-[9px] font-bold uppercase tracking-[.12em] text-moss">kelompok kegiatan {String(index + 1).padStart(2, "0")}</div>
              {preview.length ? <><label className="sr-only" htmlFor={`group-name-${index}`}>Nama kelompok {index + 1}</label><input id={`group-name-${index}`} value={team.name} maxLength={80} onChange={(e) => renamePreviewGroup(index, e.target.value)} className="mt-1 w-full rounded-lg border border-[#e4e6db] bg-white px-2 py-1 text-[13px] font-bold outline-none focus:border-moss print:hidden" /><h3 className="mt-1 hidden text-[14px] font-bold print:block">{team.name || `Kelompok ${index + 1}`}</h3></> : <h3 className="mt-1 text-[14px] font-bold">{team.name}</h3>}
            </div>
            <span className="flex h-8 shrink-0 items-center gap-1.5 rounded-full bg-[#eaf0e0] px-3 text-[10px] font-bold text-forest"><UsersRound size={13} />{team.members.length}</span>
          </div>
          <p className="mt-2 text-[9px] font-semibold text-[#758078]">Laki-laki {genderCount(team, "male")} · Perempuan {genderCount(team, "female")}{genderCount(team, "unknown") > 0 && ` · Belum diketahui ${genderCount(team, "unknown")}`}</p>
        </div>
        <div className="divide-y divide-[#f0f0e9]">{team.members.map((person, memberIndex) => <div key={person.id} className="flex items-start gap-3 px-5 py-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-[#f0f1ea] text-[9px] font-bold text-[#718075]">{memberIndex + 1}</span><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-bold">{person.fullName}</p><p className="mt-1 truncate text-[9px] text-[#89938b]">{genderLabel(person.gender)} · {person.villageName} · {person.groupName}</p></div><span className="shrink-0 text-[9px] text-[#929b92]">{person.age} th</span></div>)}</div>
      </section>)}
    </div> : <div className="card flex flex-col items-center px-6 py-14 text-center"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf1e4] text-forest"><Shuffle size={20} /></div><h2 className="mt-4 text-[14px] font-bold">Belum ada pembagian</h2><p className="mt-2 max-w-sm text-[11px] leading-5 text-[#909890]">Masukkan jumlah kelompok lalu buat pratinjau dari jamaah yang tercatat hadir.</p><a href="/admin/dashboard" className="btn-secondary mt-5">Lihat daftar hadir <ArrowRight size={13} /></a></div>}

    <style jsx global>{`@media print { body { background: #fff !important; } aside, header, button, a { display: none !important; } main { margin: 0 !important; padding: 0 !important; max-width: none !important; } .card { box-shadow: none !important; break-inside: avoid; } }`}</style>
  </div>;
}
