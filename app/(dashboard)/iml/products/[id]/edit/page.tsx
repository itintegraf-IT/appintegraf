import { auth } from "@/auth";
import { redirect } from "next/navigation";
import { getImlProductEditAccess } from "@/lib/iml/product-sample-flags-access";
import EditProductClient from "./EditProductClient";

export default async function ImlProductEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  const { id } = await params;
  const access = await getImlProductEditAccess(userId);

  if (!access.canRead) redirect("/iml");

  // Správa vzorků bez plného zápisu edituje vzor/nátisk na detailu, ne ve formuláři.
  if (access.canEditSampleFlagsOnly) {
    redirect(`/iml/products/${id}?tab=print`);
  }

  if (!access.canWrite) {
    redirect(`/iml/products/${id}`);
  }

  return <EditProductClient />;
}