import { auth } from "@/auth";
import { redirect, notFound } from "next/navigation";
import { isAdmin } from "@/lib/auth-utils";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { ArrowLeft } from "lucide-react";
import { ContractTypeForm, type ContractTypeFormInitial } from "../../ContractTypeForm";
import { normalizeContractResolver } from "@/lib/contracts/resolveApprovers";

type PageProps = { params: Promise<{ id: string }> };

export default async function AdminContractTypeEditPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    redirect("/contacts?error=Nemáte oprávnění");
  }

  const { id: idRaw } = await params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) notFound();

  const row = await prisma.contract_types.findUnique({
    where: { id },
    include: {
      contract_workflow_steps: {
        orderBy: { step_order: "asc" },
        select: { step_order: true, resolver: true, fixed_user_id: true },
      },
    },
  });

  if (!row) notFound();

  const initial: ContractTypeFormInitial = {
    id: row.id,
    name: row.name,
    code: row.code ?? "",
    description: row.description ?? "",
    sort_order: row.sort_order ?? 0,
    is_active: row.is_active !== false,
    steps: row.contract_workflow_steps.map((s) => ({
      step_order: s.step_order,
      resolver: normalizeContractResolver(s.resolver),
      fixed_user_id: s.fixed_user_id,
    })),
  };

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Upravit typ smlouvy</h1>
          <p className="mt-1 text-gray-600">{row.name}</p>
        </div>
        <Link
          href="/admin/contract-types"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Zpět
        </Link>
      </div>

      <ContractTypeForm initial={initial} />
    </>
  );
}
