import { Brand } from "@/components/brand";
import { AdminLogin } from "@/components/admin-login";

export default function AdminLoginPage() {
  return <main className="flex min-h-screen bg-[#f6f6f0]">
    <section className="relative hidden w-[44%] flex-col justify-between overflow-hidden bg-forest p-12 text-white lg:flex">
      <div className="absolute -right-20 top-[22%] h-[480px] w-[480px] rounded-full border border-white/10" /><div className="absolute -right-2 top-[31%] h-[320px] w-[320px] rounded-full border border-white/10" /><div className="absolute bottom-[-120px] left-[-100px] h-[300px] w-[300px] rounded-full bg-lime/10 blur-3xl" />
      <Brand inverse />
      <div className="relative max-w-md"><div className="mb-5 text-[10px] font-bold uppercase tracking-[.22em] text-lime">ruang pengurus</div><h1 className="text-[48px] font-bold leading-[1.06] tracking-[-.05em]">Mengurus bersama,<br /><span className="font-normal italic text-lime">menguatkan sesama.</span></h1><p className="mt-5 max-w-sm text-[14px] leading-7 text-white/65">Pantau kehadiran, siapkan kegiatan, dan bantu setiap jamaah menemukan tempatnya.</p></div>
      <p className="text-[10px] text-white/45">© 2026 Teman Akrab · Pengajian Gabungan</p>
      <div aria-hidden="true" className="absolute bottom-1/4 right-20 text-lime/25"><span className="text-[170px] leading-none">✳</span></div>
    </section>
    <section className="flex flex-1 items-center justify-center px-5 py-10 sm:px-10">
      <div className="w-full max-w-[430px]"><div className="mb-8 lg:hidden"><Brand /></div><div className="mb-7"><p className="text-[10px] font-bold uppercase tracking-[.2em] text-moss">selamat datang kembali</p><h2 className="mt-2 text-[30px] font-bold tracking-[-.045em]">Masuk ke panel admin</h2><p className="mt-2 text-[13px] text-[#838c84]">Gunakan akun pengurus untuk melanjutkan.</p></div><AdminLogin /><p className="mt-7 text-center text-[10px] text-[#a1a69f]">Akses ini khusus untuk pengurus kegiatan.</p></div>
    </section>
  </main>;
}
