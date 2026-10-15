"use client";

import { Activity, ArrowUpRight, CalendarDays, ChevronDown, CircleHelp, LayoutDashboard, LogOut, Menu, Settings2, UsersRound, X } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { Brand } from "@/components/brand";
import { PasswordChange } from "@/components/password-change";

const nav = [
  { href: "/admin/dashboard", label: "Ringkasan", icon: LayoutDashboard },
  { href: "/admin/kegiatan", label: "Kegiatan", icon: CalendarDays },
];

export function AdminFrame({ username, mustChangePassword, children }: { username: string; mustChangePassword: boolean; children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [changeOpen, setChangeOpen] = useState(mustChangePassword);
  const title = pathname.includes("pembagian") ? "Pembagian kelompok" : pathname.includes("kegiatan") ? "Kelola kegiatan" : "Ringkasan kehadiran";
  const signOut = async () => { setLoggingOut(true); await fetch("/api/admin/logout", { method: "POST" }); router.replace("/admin/login"); router.refresh(); };

  const sidebar = <div className="flex h-full flex-col">
    <div className="flex h-[76px] items-center justify-between border-b border-white/10 px-6"><Brand inverse /><button className="text-white/60 lg:hidden" onClick={() => setMobileOpen(false)} aria-label="Tutup menu"><X size={20} /></button></div>
    <div className="px-5 pt-7"><div className="mb-3 px-2 text-[9px] font-bold uppercase tracking-[.2em] text-white/35">menu utama</div><nav className="space-y-1">{nav.map(({ href, label, icon: Icon }) => {
      const active = pathname === href || (href === "/admin/kegiatan" && pathname.includes("/admin/kegiatan"));
      return <Link key={href} href={href} onClick={() => setMobileOpen(false)} className={`flex h-11 items-center gap-3 rounded-xl px-3 text-[12px] font-semibold !text-white transition ${active ? "bg-white/12" : "hover:bg-white/7"}`}><Icon size={16} className={active ? "text-lime" : ""} />{label}{active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-lime" />}</Link>;
    })}</nav></div>
    <div className="mt-auto p-5">
      <div className="rounded-2xl border border-white/10 bg-white/5 p-4"><div className="flex items-center gap-2 text-[10px] font-bold text-lime"><Activity size={13} /> PENGAJIAN GABUNGAN</div><p className="mt-2 text-[10px] leading-5 text-white/55">Empat desa, satu ruang belajar dan silaturahmi.</p><Link href="/" target="_blank" className="mt-3 flex items-center gap-1 text-[10px] font-semibold !text-white hover:!text-white">Lihat halaman peserta <ArrowUpRight size={12} /></Link></div>
      <div className="mt-4 flex items-center gap-3 rounded-xl px-2 py-2"><div className="flex h-9 w-9 items-center justify-center rounded-full bg-lime text-[11px] font-bold text-forest">{username.slice(0, 1).toUpperCase()}</div><div className="min-w-0 flex-1"><p className="truncate text-[11px] font-semibold text-white">{username}</p><p className="mt-1 text-[9px] text-white/45">Pengurus</p></div><button onClick={signOut} disabled={loggingOut} title="Keluar" className="text-white/50 transition hover:text-white">{loggingOut ? <span className="text-[10px]">...</span> : <LogOut size={16} />}</button></div>
    </div>
  </div>;

  return <div className="min-h-screen bg-[#f7f7f2] lg:flex">
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-[248px] bg-forest lg:block">{sidebar}</aside>
    {mobileOpen && <div className="fixed inset-0 z-40 lg:hidden"><button aria-label="Tutup navigasi" className="absolute inset-0 bg-ink/40" onClick={() => setMobileOpen(false)} /><aside className="absolute inset-y-0 left-0 w-[280px] bg-forest shadow-2xl">{sidebar}</aside></div>}
    <div className="min-w-0 flex-1 lg:ml-[248px]">
      <header className="sticky top-0 z-20 flex h-[70px] items-center justify-between border-b border-[#e8e8de] bg-[#f7f7f2]/90 px-4 backdrop-blur-md sm:px-7 lg:px-9">
        <div className="flex items-center gap-3"><button onClick={() => setMobileOpen(true)} aria-label="Buka navigasi" className="flex h-9 w-9 items-center justify-center rounded-xl border border-[#e7e8de] bg-white text-forest lg:hidden"><Menu size={17} /></button><div><div className="text-[9px] font-semibold uppercase tracking-[.18em] text-[#929a92]">Teman Akrab <span className="px-1">/</span> Admin</div><div className="mt-1 text-[14px] font-bold tracking-[-.02em]">{title}</div></div></div>
        <div className="flex items-center gap-3"><div className="hidden items-center gap-2 rounded-full border border-[#e5e6dc] bg-white px-3 py-2 text-[10px] font-semibold text-[#65736a] sm:flex"><span className="h-1.5 w-1.5 rounded-full bg-[#74a06e]" /> sistem siap</div><button onClick={() => setChangeOpen(true)} className="flex h-9 items-center gap-2 rounded-xl border border-[#e7e8de] bg-white px-3 text-[10px] font-semibold text-[#5f7066] hover:bg-[#f1f3eb]"><Settings2 size={14} /> <span className="hidden sm:inline">Keamanan</span></button></div>
      </header>
      <main className="mx-auto max-w-[1500px] px-4 py-6 sm:px-7 sm:py-8 lg:px-9">{mustChangePassword && <div className="mb-5 flex items-center justify-between gap-3 rounded-2xl border border-[#e6ddbf] bg-[#fbf6e6] px-4 py-3"><div className="flex items-center gap-2 text-[11px] leading-5 text-[#766641]"><CircleHelp size={15} className="shrink-0" /> Demi keamanan, ganti kata sandi awal sebelum mulai mengelola kegiatan.</div><button onClick={() => setChangeOpen(true)} className="shrink-0 text-[10px] font-bold text-forest underline underline-offset-4">Ganti sekarang</button></div>}{children}</main>
    </div>
    {changeOpen && <PasswordChange onClose={() => setChangeOpen(false)} required={mustChangePassword} />}
  </div>;
}
