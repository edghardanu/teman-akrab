import { LockKeyhole } from "lucide-react";
import Link from "next/link";
import { AttendanceForm } from "@/components/attendance-form";
import { Brand } from "@/components/brand";

export default function HomePage() {
  return <main className="page-grain min-h-screen overflow-hidden">
    <div className="mx-auto max-w-[1180px] px-5 pb-12 pt-5 sm:px-8 lg:px-10">
      <header className="flex items-center justify-between border-b border-[#e9e8de] pb-4">
        <Brand />
        <div className="flex items-center gap-4"><span className="hidden text-[11px] text-[#8e978f] sm:block">Bersama dalam kebaikan</span><Link href="/admin/login" aria-label="Masuk admin" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#e6e6dc] bg-white text-forest transition hover:bg-[#eef1e8]"><LockKeyhole size={15} /></Link></div>
      </header>
      <section className="py-8 sm:py-11 lg:py-14"><AttendanceForm /></section>
      <footer className="flex flex-col gap-3 border-t border-[#e9e8de] pt-5 text-[10px] text-[#8b948c] sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2"><Brand compact /><span>© 2026 Teman Akrab</span></div>
        <p>Dirawat bersama oleh pengurus pengajian empat desa.</p>
        <span>Silaturahmi lintas desa · Satu ruang belajar bersama.</span>
      </footer>
    </div>
    <div aria-hidden="true" className="pointer-events-none absolute -bottom-24 -left-20 -z-10 h-72 w-72 rounded-full bg-[#e7eddb] blur-3xl" />
  </main>;
}
