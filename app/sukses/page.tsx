"use client";

import { ArrowLeft, Check, Flower2, Heart, Sparkles } from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";

export default function SuccessPage() {
  const [name, setName] = useState("");
  const [event, setEvent] = useState("Pengajian Gabungan");
  useEffect(() => { setName(sessionStorage.getItem("attendance-name") ?? ""); setEvent(sessionStorage.getItem("attendance-event") ?? "Pengajian Gabungan"); }, []);
  return <main className="page-grain flex min-h-screen items-center justify-center px-5 py-10">
    <div className="card relative w-full max-w-[520px] overflow-hidden px-6 py-10 text-center sm:px-12 sm:py-14">
      <div aria-hidden="true" className="absolute -right-10 -top-10 h-36 w-36 rounded-full bg-[#f1f3e8]" />
      <div className="relative mx-auto flex h-[76px] w-[76px] items-center justify-center rounded-[26px] bg-forest text-lime shadow-lg shadow-forest/20"><Check size={34} strokeWidth={2.5} /><Sparkles size={15} className="absolute right-2 top-2 text-coral" /></div>
      <div className="mt-7 text-[10px] font-bold uppercase tracking-[.23em] text-moss">pendaftaran diproses</div>
      <h1 className="mt-3 text-[34px] font-bold leading-tight tracking-[-.05em]">Terima kasih{name ? `, ${name.split(" ")[0]}` : ""}.</h1>
      <p className="mx-auto mt-3 max-w-sm text-[14px] leading-6 text-[#768078]">Pendaftaran untuk <strong className="font-semibold text-ink">{event}</strong> sudah diproses. Jika kamu pernah mendaftar sebelumnya, data yang sudah ada tetap digunakan. Sampai bertemu di majelis ilmu.</p>
      <div className="mx-auto mt-7 flex max-w-sm items-center gap-3 rounded-2xl bg-[#f6f6ef] p-4 text-left"><div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#e8edda] text-forest"><Heart size={18} /></div><p className="text-[11px] leading-5 text-[#727d74]">Satu langkah kecil untuk menjaga silaturahmi. Semoga pertemuan kita membawa berkah.</p></div>
      <Link href="/" className="btn-primary mt-8"><ArrowLeft size={15} /> Kembali ke halaman utama</Link>
      <div className="mt-8 flex items-center justify-center gap-2 text-[10px] text-[#a0a69e]"><Flower2 size={13} className="text-moss" /> Teman Akrab · Pengajian Gabungan</div>
    </div>
  </main>;
}
