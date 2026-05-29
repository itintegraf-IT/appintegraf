import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { MaterialEditForm } from "../../_components/MaterialEditForm";
import { MaterialyLiveAttachmentUploader } from "../../_components/MaterialyAttachmentFields";

export default async function MaterialEditPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  const canWrite = await hasModuleAccess(userId, "materialy", "write");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Upravit materiál</h1>
      <MaterialEditForm materialId={id} />
      {canWrite ? (
        <div className="mt-6 max-w-lg">
          <MaterialyLiveAttachmentUploader materialId={id} />
          <p className="mt-2 text-xs text-gray-500">
            Nahrané soubory uvidíte také na{" "}
            <a className="text-red-600 hover:underline" href={`/materialy/${id}`}>
              detailu materiálu
            </a>
            .
          </p>
        </div>
      ) : null}
    </>
  );
}