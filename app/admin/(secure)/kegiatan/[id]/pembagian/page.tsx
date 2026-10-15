import { notFound } from "next/navigation";
import { ShuffleViewClient } from "@/components/admin-view-client";

export default async function ShufflePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <ShuffleViewClient eventId={id} />;
}
