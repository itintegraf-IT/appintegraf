import { auth } from "@/auth";
import { hasModuleAccess } from "@/lib/auth-utils";
import { redirect, notFound } from "next/navigation";
import { ImlTechnologieDetailClient } from "../ImlTechnologieDetailClient";

export default async function ImlTechnologieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    redirect("/");
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  return <ImlTechnologieDetailClient id={id} />;
}
