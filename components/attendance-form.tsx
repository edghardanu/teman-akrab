"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Check, ChevronDown, LoaderCircle } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { attendanceSchema } from "@/lib/validation";
import { safeJson } from "@/components/api-json";

type FormValues = z.output<typeof attendanceSchema>;
type FormInput = z.input<typeof attendanceSchema>;
type EventData = { id: number; name: string };
type Option = { id: number; name: string };

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

  return <div className="card w-full p-5 sm:p-8">
      <div className="mb-6 flex items-center justify-center gap-3">
        <Image src="/gencar.jpeg" alt="Logo Generus Cengkareng" width={48} height={48} priority className="h-12 w-12 rounded-xl object-cover" />
        <span className="text-[15px] font-bold text-[#111827]">Generus Cengkareng</span>
      </div>
      <div className="mb-6 text-center">
        <h1 className="text-[22px] font-bold tracking-[-.035em]">Isi data kehadiran</h1>
      </div>
      {!event && !loading ? <div className="rounded-2xl border border-[#ede8d9] bg-[#fcfaf4] p-5 text-sm leading-6 text-[#717b73]">{submitError || "Belum ada kegiatan aktif. Silakan kembali setelah panitia membuka absensi."}</div> : <form onSubmit={handleSubmit(onSubmit)} className="relative space-y-4" noValidate>
        <div><label className="field-label" htmlFor="fullName">Nama lengkap</label><input id="fullName" autoComplete="name" className="input-field" placeholder="Contoh: Siti Aminah" {...register("fullName")} />{errors.fullName && <p className="field-error">{errors.fullName.message}</p>}</div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="villageId">Desa</label><div className="relative"><select id="villageId" className="input-field appearance-none pr-10" defaultValue="" {...register("villageId")}><option value="">Pilih desa</option>{villages.map((village) => <option key={village.id} value={village.id}>{village.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-[18px] text-[#829087]" /></div>{errors.villageId && <p className="field-error">{errors.villageId.message}</p>}</div>
          <div><label className="field-label" htmlFor="groupId">Kelompok asal</label><div className="relative"><select id="groupId" className="input-field appearance-none pr-10" disabled={!selectedVillage || loadingGroups} defaultValue="" {...register("groupId")}><option value="">{!selectedVillage ? "Pilih desa dulu" : loadingGroups ? "Memuat kelompok..." : groups.length ? "Pilih kelompok" : "Belum ada kelompok"}</option>{groups.map((group) => <option key={group.id} value={group.id}>{group.name}</option>)}</select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-[18px] text-[#829087]" /></div>{errors.groupId && <p className="field-error">{errors.groupId.message}</p>}</div>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div><label className="field-label" htmlFor="age">Umur</label><div className="relative"><input id="age" type="number" inputMode="numeric" min={5} max={100} placeholder="Contoh: 28" className="input-field pr-16" {...register("age")} /><span className="absolute right-4 top-[17px] text-[11px] text-[#97a097]">tahun</span></div>{errors.age && <p className="field-error">{errors.age.message}</p>}</div>
          <div><label className="field-label" htmlFor="gender">Jenis kelamin</label><div className="relative"><select id="gender" className="input-field appearance-none pr-10" defaultValue="" {...register("gender")}><option value="">Pilih jenis kelamin</option><option value="male">Laki-laki</option><option value="female">Perempuan</option></select><ChevronDown size={15} className="pointer-events-none absolute right-4 top-[18px] text-[#829087]" /></div>{errors.gender && <p className="field-error">{errors.gender.message}</p>}</div>
        </div>
        <div><label className="field-label" htmlFor="occupation">Pekerjaan</label><input id="occupation" maxLength={100} placeholder="Contoh: Mahasiswa" className="input-field" {...register("occupation")} />{errors.occupation && <p className="field-error">{errors.occupation.message}</p>}</div>
        {submitError && <div role="alert" className="rounded-xl border border-[#f2d4ca] bg-[#fff7f4] px-4 py-3 text-[12px] leading-5 text-[#a5523e]">{submitError}</div>}
        <button className="btn-primary mt-2 w-full" type="submit" disabled={!event || isSubmitting || loading}>{isSubmitting ? <><LoaderCircle size={16} className="spin" /> Menyimpan kehadiran...</> : <>Kirim kehadiran <ArrowRight size={16} /></>}</button>
        <p className="flex items-center justify-center gap-1.5 pt-1 text-center text-[10px] text-[#9ba098]"><Check size={12} className="text-moss" /> Data hanya digunakan untuk keperluan kegiatan ini.</p>
      </form>}
  </div>;
}
