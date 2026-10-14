"use client";

import { Eye, EyeOff, LoaderCircle, X } from "lucide-react";
import { useState } from "react";
import { safeJson } from "@/components/api-json";

export function PasswordChange({ onClose, required = false }: { onClose: () => void; required?: boolean }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [show, setShow] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (event: React.FormEvent) => {
    event.preventDefault(); setError("");
    if (newPassword.length < 10) { setError("Kata sandi baru minimal 10 karakter."); return; }
    setBusy(true);
    const response = await fetch("/api/admin/password", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ currentPassword, newPassword }) }).catch(() => null);
    const data = await safeJson(response); setBusy(false);
    if (!response?.ok) { setError(data?.error ?? "Kata sandi belum dapat diubah."); return; }
    window.location.reload();
  };
  return <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 p-4 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-labelledby="password-title">
    <form onSubmit={submit} className="card w-full max-w-[440px] p-6 sm:p-8">
      {!required && <button type="button" onClick={onClose} aria-label="Tutup" className="float-right text-[#88938a]"><X size={18} /></button>}
      <div className="text-[9px] font-bold uppercase tracking-[.2em] text-moss">keamanan akun</div><h2 id="password-title" className="mt-2 text-[23px] font-bold tracking-[-.03em]">Ganti kata sandi</h2><p className="mt-2 text-[12px] leading-5 text-[#818b83]">Gunakan kata sandi minimal 10 karakter.</p>
      <div className="mt-6 space-y-4"><div><label className="field-label" htmlFor="current-password">Kata sandi saat ini</label><input id="current-password" required type={show ? "text" : "password"} className="input-field" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} /></div><div><label className="field-label" htmlFor="new-password">Kata sandi baru</label><div className="relative"><input id="new-password" required minLength={10} type={show ? "text" : "password"} className="input-field pr-12" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} /><button type="button" aria-label="Tampilkan atau sembunyikan kata sandi" onClick={() => setShow(!show)} className="absolute right-4 top-4 text-[#89938a]">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div></div></div>
      {error && <p role="alert" className="mt-4 rounded-xl bg-[#fff3ef] px-3 py-2 text-[11px] text-[#a5523e]">{error}</p>}
      <div className="mt-6 flex gap-2">{!required && <button type="button" onClick={onClose} className="btn-secondary flex-1">Batal</button>}<button type="submit" disabled={busy} className="btn-primary flex-1">{busy ? <><LoaderCircle size={15} className="spin" /> Menyimpan...</> : "Simpan kata sandi"}</button></div>
    </form>
  </div>;
}
