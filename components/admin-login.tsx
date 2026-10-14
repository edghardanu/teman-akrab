"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, Eye, EyeOff, LoaderCircle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { loginSchema } from "@/lib/validation";
import { safeJson } from "@/components/api-json";

type Values = z.infer<typeof loginSchema>;
export function AdminLogin() {
  const router = useRouter();
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm<Values>({ resolver: zodResolver(loginSchema) });
  useEffect(() => {
    fetch("/api/admin/me").then((response) => { if (response.ok) router.replace("/admin/dashboard"); });
  }, [router]);
  const submit = async (values: Values) => {
    setError("");
    const response = await fetch("/api/admin/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(values) }).catch(() => null);
    const data = await safeJson(response);
    if (!response?.ok) { setError(data?.error ?? "Koneksi gagal. Silakan coba lagi."); return; }
    router.replace("/admin/dashboard");
  };
  return <>
    {error && <div role="alert" className="mb-5 rounded-xl border border-[#f1d6ce] bg-[#fff6f2] px-4 py-3 text-[12px] leading-5 text-[#a34f3b]">{error}</div>}
    <form onSubmit={handleSubmit(submit)} className="space-y-5" noValidate>
      <div><label htmlFor="username" className="field-label">Username</label><input id="username" autoComplete="username" placeholder="nama@organisasi.id" className="input-field" {...register("username")} />{errors.username && <p className="field-error">Username wajib diisi.</p>}</div>
      <div><label htmlFor="password" className="field-label">Kata sandi</label><div className="relative"><input id="password" type={showPassword ? "text" : "password"} autoComplete="current-password" placeholder="Masukkan kata sandi" className="input-field pr-12" {...register("password")} /><button type="button" aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"} onClick={() => setShowPassword((value) => !value)} className="absolute right-3 top-[15px] text-[#88938a]">{showPassword ? <EyeOff size={17} /> : <Eye size={17} />}</button></div>{errors.password && <p className="field-error">Kata sandi wajib diisi.</p>}</div>
      <button className="btn-primary w-full" type="submit" disabled={isSubmitting}>{isSubmitting ? <><LoaderCircle size={16} className="spin" /> Memeriksa akun...</> : <>Masuk ke dashboard <ArrowRight size={16} /></>}</button>
    </form>
  </>;
}
