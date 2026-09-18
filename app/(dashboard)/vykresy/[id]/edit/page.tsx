import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { canWriteVykresy } from "@/lib/vykresy/access";
import { isVykresyDocumentKind } from "@/lib/vykresy/constants";
import { VykresyForm } from "../../VykresyForm";

export default async function VykresyEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await canWriteVykresy(userId))) redirect("/vykresy");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const item = await prisma.vykresy.findUnique({ where: { id } });
  if (!item) notFound();

  const document_kind = isVykresyDocumentKind(item.document_kind)
    ? item.document_kind
    : "other";

  return (
    <VykresyForm
      mode="edit"
      id={item.id}
      initial={{
        name: item.name,
        document_kind,
        department_id: item.department_id != null ? String(item.department_id) : "",
        machine_id: item.machine_id != null ? String(item.machine_id) : "",
        description: item.description ?? "",
      }}
    />
  );
}
