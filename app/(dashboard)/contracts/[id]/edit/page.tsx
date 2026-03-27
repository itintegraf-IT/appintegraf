import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { ContractForm } from "../../ContractForm";

export default async function EditContractPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) notFound();

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  const userId = parseInt(session.user.id, 10);
  const admin = await isAdmin(userId);

  const contract = await prisma.contracts.findUnique({ where: { id } });
  if (!contract) notFound();

  const editable =
    (contract.approval_status === ContractApprovalStatus.DRAFT ||
      contract.approval_status === ContractApprovalStatus.RETURNED) &&
    (contract.created_by === userId || admin);

  if (!editable) {
    redirect(`/contracts/${id}`);
  }

  return (
    <ContractForm
      mode="edit"
      contractId={id}
      initial={{
        title: contract.title,
        contract_number: contract.contract_number,
        party_company: contract.party_company,
        party_contact: contract.party_contact,
        contract_type_id: contract.contract_type_id,
        description: contract.description,
        value_amount: contract.value_amount?.toString() ?? null,
        value_currency: contract.value_currency,
        effective_from: contract.effective_from?.toISOString() ?? null,
        valid_until: contract.valid_until?.toISOString() ?? null,
        expires_at: contract.expires_at?.toISOString() ?? null,
        responsible_user_id: contract.responsible_user_id,
        department_id: contract.department_id,
      }}
    />
  );
}
