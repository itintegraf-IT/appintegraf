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

  const row = await prisma.technologie.findUnique({
    where: { id },
    include: {
      technologie_products: {
        orderBy: [{ sort_order: "asc" }, { id: "asc" }],
        select: { name: true, format_text: true, note: true },
      },
    },
  });
  if (!row) notFound();

  const products =
    row.technologie_products.length > 0
      ? row.technologie_products.map((p) => ({
          name: p.name,
          format_text: p.format_text ?? "",
          note: p.note ?? "",
        }))
      : [{ name: "", format_text: "", note: "" }];

  return (
    <TechnologieForm
      mode="edit"
      id={id}
      initial={{
        code: row.code,
        sheet_type_id: row.sheet_type_id != null ? String(row.sheet_type_id) : "",
        sheet_size_id: row.sheet_size_id != null ? String(row.sheet_size_id) : "",
        print_machine_id: row.print_machine_id != null ? String(row.print_machine_id) : "",
        die_cut_device_id: row.die_cut_device_id != null ? String(row.die_cut_device_id) : "",
        is_iml: row.is_iml === true,
        products,
      }}
    />
  );
}
