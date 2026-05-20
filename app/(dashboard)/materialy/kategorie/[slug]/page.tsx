import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadMaterialCatalog } from "@/lib/materialy/access";
import { findCategoryBySlug } from "@/lib/materialy/load-categories";
import { redirect, notFound } from "next/navigation";
import { MaterialyListClient } from "../../_components/MaterialyListClient";

export default async function MaterialyCategoryPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canReadMaterialCatalog(userId))) redirect("/");

  const slug = (await params).slug.trim().toLowerCase();
  const cat = await findCategoryBySlug(slug);
  if (!cat) notFound();

  const canWrite = await hasModuleAccess(userId, "materialy", "write");

  return (
    <>
      <h1 className="mb-4 text-2xl font-bold">{cat.label}</h1>
      <MaterialyListClient category={cat.code} categoryLabel={cat.label} canWrite={canWrite} />
    </>
  );
}
