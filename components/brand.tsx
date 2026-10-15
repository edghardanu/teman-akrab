import Image from "next/image";

export function Brand({ compact = false, inverse = false, subtitle = "pengajian gabungan" }: { compact?: boolean; inverse?: boolean; subtitle?: string }) {
  return <div className={`flex items-center gap-3 ${inverse ? "text-white" : "text-ink"}`}>
    <div className="relative h-11 w-11 shrink-0 overflow-hidden rounded-[15px] bg-white">
      <Image src="/gencar.jpeg" alt="Logo Generus Cengkareng" fill sizes="44px" className="object-cover" />
    </div>
    {!compact && <span className="leading-tight"><strong className="block text-[15px] tracking-[-.03em]">Generus Cengkareng</strong><small className={`mt-1 block text-[9px] uppercase tracking-[.22em] ${inverse ? "text-white/55" : "text-moss"}`}>{subtitle}</small></span>}
  </div>;
}
