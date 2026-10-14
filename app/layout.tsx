import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Teman Akrab — Absensi Pengajian Gabungan",
  description: "Satu ruang untuk mencatat kehadiran dan merawat silaturahmi empat desa.",
  applicationName: "Teman Akrab",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="id"><body>{children}</body></html>;
}
