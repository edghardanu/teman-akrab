"use client";

import dynamic from "next/dynamic";
import { LoaderCircle } from "lucide-react";

function LoadingPanel({ label = "Menyiapkan tampilan di perangkat..." }: { label?: string }) {
  return <div className="card flex min-h-56 items-center justify-center gap-2 text-[12px] text-[#8f988f]">
    <LoaderCircle size={16} className="spin" /> {label}
  </div>;
}

const DashboardView = dynamic(
  () => import("@/components/dashboard-view").then((module) => module.DashboardView),
  { ssr: false, loading: () => <LoadingPanel label="Memuat dashboard..." /> },
);

const ManageView = dynamic(
  () => import("@/components/manage-view").then((module) => module.ManageView),
  { ssr: false, loading: () => <LoadingPanel label="Memuat pengelolaan kegiatan..." /> },
);

const ShuffleView = dynamic(
  () => import("@/components/shuffle-view").then((module) => module.ShuffleView),
  { ssr: false, loading: () => <LoadingPanel label="Memuat pembagian kelompok..." /> },
);

export function DashboardViewClient() {
  return <DashboardView />;
}

export function ManageViewClient() {
  return <ManageView />;
}

export function ShuffleViewClient({ eventId }: { eventId: number }) {
  return <ShuffleView eventId={eventId} />;
}
