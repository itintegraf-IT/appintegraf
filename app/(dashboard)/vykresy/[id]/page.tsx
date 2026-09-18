import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canReadVykresy } from "@/lib/vykresy/access";
import { VykresyDetailClient } from "./VykresyDetailClient";

export default async function VykresyDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canReadVykresy(userId))) redirect("/");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const canWrite = await hasModuleAccess(userId, "vykresy", "write");

  return <VykresyDetailClient id={id} canWrite={canWrite} />;
}
