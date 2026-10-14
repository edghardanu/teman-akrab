import { notFound } from "next/navigation";
import { ShuffleView } from "@/components/shuffle-view";

export default async function ShufflePage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) notFound();
  return <ShuffleView eventId={id} />;
}
