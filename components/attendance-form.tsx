"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, ChevronDown, Clock3, LoaderCircle, MapPin, UsersRound } from "lucide-react";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { attendanceSchema } from "@/lib/validation";
import { safeJson } from "@/components/api-json";

type FormValues = z.output<typeof attendanceSchema>;
type FormInput = z.input<typeof attendanceSchema>;
type EventData = { id: number; name: string; eventDate: string; eventTime: string; location: string; description?: string | null };
type Option = { id: number; name: string };

function formatDate(value: string) {
  return new Intl.DateTimeFormat("id-ID", { day: "numeric", month: "long", year: "numeric", timeZone: "Asia/Jakarta" }).format(new Date(`${value}T12:00:00+07:00`));
}

export function AttendanceForm() {
  const router = useRouter();
  const [event, setEvent] = useState<EventData | null>(null);
  const [villages, setVillages] = useState<Option[]>([]);
  const [groups, setGroups] = useState<Option[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitError, setSubmitError] = useState("");
  const [loadingGroups, setLoadingGroups] = useState(false);
  const { register, handleSubmit, watch, setValue, formState: { errors, isSubmitting } } = useForm<FormInput, unknown, FormValues>({ resolver: zodResolver(attendanceSchema), defaultValues: { fullName: "", occupation: "" } });
  const selectedVillage = watch("villageId");

  useEffect(() => {
    let mounted = true;
    Promise.all([fetch("/api/public/active-event", { cache: "no-store" }).then((r) => safeJson<{ event: EventData | null }>(r)), fetch("/api/public/villages", { cache: "no-store" }).then((r) => safeJson<{ villages: Option[] }>(r))])
      .then(([eventData, villageData]) => {
        if (!mounted) return;
        setEvent(eventData.event);
        setVillages(villageData.villages ?? []);
      })
      .catch(() => { if (mounted) setSubmitError("Koneksi sedang bermasalah. Muat ulang halaman untuk mencoba kembali."); })
      .finally(() => { if (mounted) setLoading(false); });
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!selectedVillage) { setGroups([]); return; }
    setLoadingGroups(true);
    setValue("groupId", undefined as unknown as number);
    fetch(`/api/public/groups?villageId=${Number(selectedVillage)}`, { cache: "no-store" })
      .then((response) => safeJson<{ groups: Option[] }>(response))
      .then((data) => setGroups(data.groups ?? []))
      .catch(() => setGroups([]))
      .finally(() => setLoadingGroups(false));
  }, [selectedVillage, setValue]);

  const onSubmit = async (values: FormValues) => {
    setSubmitError("");
    try {
      const response = await fetch("/api/public/attendance", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) });
      const result = await safeJson<{ error?: string }>(response);
      if (!response.ok) { setSubmitError(result.error ?? "Data belum dapat disimpan."); return; }
      sessionStorage.setItem("attendance-name", values.fullName.trim());
      sessionStorage.setItem("attendance-event", event?.name ?? "Pengajian Gabungan");
      router.push("/sukses");
    } catch {
      setSubmitError("Koneksi terputus. Periksa jaringan lalu coba lagi.");
    }
  };

  return <div className="grid items-start gap-8 lg:grid-cols-[.88fr_1.12fr] lg:gap-16">
    <div className="pt-2 lg:pt-10">
      <div className="mb-5 inline-flex items-center gap-2 rounded-full border border-[#e5e8d8] bg-white/75 px-3 py-2 text-[10px] font-bold uppercase tracking-[.18em] text-forest"><span className="h-1.5 w-1.5 rounded-full bg-[#80a36a]" /> ruang silaturahmi empat desa</div>
      <h1 className="max-w-[560px] text-[42px] font-bold leading-[1.04] tracking-[-.055em] text-ink sm:text-[56px] lg:text-[66px]">Satu niat,<br /><span className="font-normal italic text-forest">satu saf.</span></h1>
      <p className="mt-5 max-w-[420px] text-[15px] leading-7 text-[#748079]">Mari berkumpul, belajar, dan menguatkan persaudaraan. Catat kehadiranmu untuk pengajian gabungan kali ini.</p>

      <div className="relative mt-8 overflow-hidden rounded-[22px] bg-forest p-5 text-white sm:mt-10 sm:p-6">
        <div className="absolute -right-7 -top-8 h-32 w-32 rounded-full border border-white/10" /><div className="absolute -right-1 top-0 h-20 w-20 rounded-full border border-white/10" />
        <div className="relative flex items-center gap-2 text-[9px] font-bold uppercase tracking-[.2em] text-lime"><span className="h-1.5 w-1.5 rounded-full bg-lime" /> kegiatan berlangsung</div>
        {loading ? <div className="relative mt-4 h-7 w-48 animate-pulse rounded bg-white/15" /> : event ? <>
          <h2 className="relative mt-3 max-w-sm text-[21px] font-bold leading-tight tracking-[-.03em]">{event.name}</h2>
          <div className="relative mt-5 flex flex-wrap gap-x-5 gap-y-2 text-[11px] text-white/75">
            <span className="flex items-center gap-1.5"><Clock3 size={13} className="text-lime" />{formatDate(event.eventDate)} · {event.eventTime} WIB</span>
            <span className="flex items-center gap-1.5"><MapPin size={13} className="text-lime" />{event.location}</span>
          </div>
        </> : <><h2 className="relative mt-3 text-[18px] font-bold">Belum ada kegiatan dibuka</h2><p className="relative mt-2 max-w-sm text-[12px] leading-5 text-white/65">Form absensi akan tersedia saat panitia membuka kegiatan berikutnya.</p></>}
        {event?.description && <p className="relative mt-4 max-w-md border-t border-white/15 pt-3 text-xs leading-5 text-white/65">{event.description}</p>}
      </div>

      <div className="mt-6 flex items-center gap-3 rounded-[18px] border border-[#e8e7de] bg-white/60 p-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#eaf0dc] text-forest"><UsersRound size={17} /></div>
        <div><p className="text-[11px] font-bold">Bandara · Cengkareng · Kalideres · Cipondoh</p><p className="mt-1 text-[10px] text-[#90978f]">Empat desa, satu kebersamaan.</p></div>
      </div>
    </div>

    <div className="card relative overflow-hidden p-5 sm:p-8">
      <div className="absolute right-0 top-0 h-24 w-24 rounded-bl-[70px] bg-[#f4f5ec]" />
      <div className="relative mb-6 flex items-start justify-between gap-4">
        <div><div className="text-[10px] font-bold uppercase tracking-[.18em] text-moss">formulir kehadiran</div><h2 className="mt-2 text-[22px] font-bold tracking-[-.035em]">Isi data diri</h2><p className="mt-1 text-[12px] text-[#8b938c]">Hanya butuh waktu sekitar satu menit.</p></div>
        <span className="rounded-full bg-[#f1f3e9] px-3 py-1.5 text-[10px] font-semibold text-forest">{event ? "Pendaftaran dibuka" : "Pendaftaran ditutup"}</span>
      </div>
      {!event && !loading ? <div className="rounded-2xl border border-[#ede8d9] bg-[#fcfaf4] p-5 text-sm leading-6 text-[#717b73]">{submitError || "Belum ada kegiatan aktif. Silakan kembali setelah panitia membuka absensi."}</div> : <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4" noValidate>
        <div><label className="field-label" htmlFor="fullName">Nama lengkap <span className="field-hint">sesuai panggilan</span></label><input id="fullName" autoComplete="name" className="input-field" placeholder="Contoh: Siti Aminah" {...register("fullName")} />{errors.fullName && <p className="field-error">{errors.fullName.message}</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="villageId">Desa</label><div className="relative"><select id="villageId" className="input-field appearance-none pr-10" defaultValue="" {...register("villageId")}><option value="">Pilih desa</option>{villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-[18px] text-[#829087]" /></div>{errors.villageId && <p className="field-error">{errors.villageId.message}</p>}</div>
          <div><label className="field-label" htmlFor="groupId">Kelompok asal</label><div className="relative"><select id="groupId" className="input-field appearance-none pr-10" disabled={!selectedVillage || loadingGroups} defaultValue="" {...register("groupId")}><option value="">{!selectedVillage ? "Pilih desa dulu" : loadingGroups ? "Memuat kelompok..." : groups.length ? "Pilih kelompok" : "Belum ada kelompok"}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-[18px] text-[#829087]" /></div>{errors.groupId && <p className="field-error">{errors.groupId.message}</p>}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="age">Umur <span className="field-hint">5–100 tahun</span></label><div className="relative"><input id="age" type="number" inputMode="numeric" min={5} max={100} placeholder="Contoh: 28" className="input-field pr-16" {...register("age")} /><span className="absolute right-4 top-[17px] text-[11px] text-[#97a097]">tahun</span></div>{errors.age && <p className="field-error">{errors.age.message}</p>}</div>
          <div><label className="field-label" htmlFor="occupation">Pekerjaan</label><input id="occupation" maxLength={100} placeholder="Contoh: Ibu rumah tangga" className="input-field" {...register("occupation")} />{errors.occupation && <p className="field-error">{errors.occupation.message}</p>}</div>
        </div>
        {submitError && <div role="alert" className="rounded-xl border border-[#f2d4ca] bg-[#fff7f4] px-4 py-3 text-[12px] leading-5 text-[#a5523e]">{submitError}</div>}
        <button className="btn-primary mt-2 w-full" type="submit" disabled={!event || isSubmitting || loading}>{isSubmitting ? <><LoaderCircle size={16} className="spin" /> Menyimpan kehadiran...</> : <>Kirim kehadiran <ArrowRight size={16} /></>}</button>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[10px] text-[#9ba098]"><Check size={12} className="text-moss" /> Data hanya digunakan untuk keperluan kegiatan ini.</p>
      </form>}
    </div>
  </div>;
}
