import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadMaterialCatalog } from "@/lib/materialy/access";
import { redirect } from "next/navigation";
import { MaterialyListClient } from "../_components/MaterialyListClient";

export default async function MaterialyLakyPage() {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) redirect("/");
  const canWrite = await hasModuleAccess(userId, "materialy", "write");

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">Laky</h1>
      <MaterialyListClient category="LACQUER" canWrite={canWrite} />
    </>
  );
}
