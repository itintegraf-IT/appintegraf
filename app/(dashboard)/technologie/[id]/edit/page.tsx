import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { TechnologieForm } from "../../TechnologieForm";

export default async function TechnologieEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "technologie", "write"))) redirect("/technologie");

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const row = await prisma.technologie.findUnique({ where: { id } });
  if (!row) notFound();

  return (
    <TechnologieForm
      mode="edit"
      id={id}
      initial={{
        code: row.code,
        name: row.name,
        sheet_type_id: row.sheet_type_id != null ? String(row.sheet_type_id) : "",
        format_text: row.format_text ?? "",
        sheet_size_text: row.sheet_size_text ?? "",
        print_machine_id: row.print_machine_id != null ? String(row.print_machine_id) : "",
        note: row.note ?? "",
      }}
    />
  );
}
