import { Flower2, Sparkles } from "lucide-react";

export function Brand({ compact = false, inverse = false }: { compact?: boolean; inverse?: boolean }) {
  return <div className={`flex items-center gap-3 ${inverse ? "text-white" : "text-ink"}`}>
    <div className={`relative flex h-11 w-11 shrink-0 items-center justify-center rounded-[15px] ${inverse ? "bg-white/10" : "bg-forest"}`}>
      <Flower2 size={23} strokeWidth={1.7} className={inverse ? "text-lime" : "text-lime"} />
      <Sparkles size={11} className="absolute right-[8px] top-[8px] text-coral" />
    </div>
    {!compact && <span className="leading-tight"><strong className="block text-[15px] tracking-[-.03em]">teman akrab</strong><small className={`mt-1 block text-[9px] uppercase tracking-[.22em] ${inverse ? "text-white/55" : "text-moss"}`}>pengajian gabungan</small></span>}
  </div>;
}
