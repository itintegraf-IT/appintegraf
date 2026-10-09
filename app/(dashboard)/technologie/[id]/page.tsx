import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadTechnologie } from "@/lib/technologie/access";
import { TechnologieDetailClient } from "./TechnologieDetailClient";

export default async function TechnologieDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadTechnologie(userId))) redirect("/");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const canWrite = await hasModuleAccess(userId, "technologie", "write");

  return <TechnologieDetailClient id={id} canWrite={canWrite} />;
}
