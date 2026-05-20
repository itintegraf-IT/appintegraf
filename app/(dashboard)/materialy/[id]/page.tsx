import { Suspense } from "react";
import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadMaterialCatalog } from "@/lib/materialy/access";
import { redirect, notFound } from "next/navigation";
import { MaterialDetailClient } from "../_components/MaterialDetailClient";

export default async function MaterialDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) redirect("/");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const canWrite = await hasModuleAccess(userId, "materialy", "write");

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Detail materiálu</h1>
      <Suspense fallback={<p className="text-sm text-gray-500">Načítání…</p>}>
        <MaterialDetailClient id={id} canWrite={canWrite} />
      </Suspense>
    </>
  );
}
