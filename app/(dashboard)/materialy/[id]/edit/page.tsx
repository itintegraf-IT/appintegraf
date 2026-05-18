import { notFound } from "next/navigation";
import { MaterialEditForm } from "../../_components/MaterialEditForm";

export default async function MaterialEditPage({ params }: { params: Promise<{ id: string }> }) {
  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Upravit materiál</h1>
      <MaterialEditForm materialId={id} />
    </>
  );
}
