import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Pencil } from "lucide-react";
import { contractStatusLabel } from "@/lib/contracts/status-labels";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { ContractApprovalPanel } from "../ContractApprovalPanel";
import { DeleteContractButton } from "./DeleteContractButton";
import { ContractLifecyclePanel } from "./ContractLifecyclePanel";
import { ContractAttachments } from "./ContractAttachments";
import { canManageContractRecord, canModifyAttachments } from "@/lib/contracts/access";

function statusVariant(
  s: string
): "default" | "secondary" | "destructive" | "outline" {
  if (s === ContractApprovalStatus.REJECTED) return "destructive";
  if (s === ContractApprovalStatus.DRAFT || s === ContractApprovalStatus.RETURNED)
    return "secondary";
  if (s === ContractApprovalStatus.IN_APPROVAL) return "default";
  if (s === ContractApprovalStatus.APPROVAL_COMPLETED) return "outline";
  if (s === ContractApprovalStatus.SIGNATURE_PENDING) return "default";
  if (s === ContractApprovalStatus.SIGNED) return "secondary";
  if (s === ContractApprovalStatus.ARCHIVED) return "outline";
  return "outline";
}

function fmtDate(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleString("cs-CZ", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

function fmtDay(d: Date | null): string {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("cs-CZ");
}

export default async function ContractDetailPage({
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

  const contract = await prisma.contracts.findUnique({
    where: { id },
    include: {
      contract_types: true,
      users_created_by: { select: { id: true, first_name: true, last_name: true, email: true } },
      users_responsible: { select: { id: true, first_name: true, last_name: true } },
      departments: { select: { id: true, name: true } },
      contract_approvals: {
        orderBy: { approval_order: "asc" },
        include: {
          users: { select: { id: true, first_name: true, last_name: true } },
        },
      },
    },
  });

  if (!contract) notFound();

  const pending = contract.contract_approvals.find((a) => a.status === "pending");
  const canEdit =
    (contract.approval_status === ContractApprovalStatus.DRAFT ||
      contract.approval_status === ContractApprovalStatus.RETURNED) &&
    (contract.created_by === userId || admin);
  const canDelete = canEdit;

  const canManage = canManageContractRecord(contract, userId, admin);
  const canUploadFiles = canManage && canModifyAttachments(contract.approval_status);
  const readOnlyArchived =
    contract.approval_status === ContractApprovalStatus.ARCHIVED;

  const attachmentRows = await prisma.file_uploads.findMany({
    where: { module: "contracts", record_id: id },
    orderBy: { created_at: "desc" },
    include: {
      users: { select: { first_name: true, last_name: true } },
    },
  });

  const initialFiles = attachmentRows.map((f) => ({
    id: f.id,
    original_filename: f.original_filename,
    file_path: f.file_path,
    file_size: f.file_size,
    mime_type: f.mime_type,
    uploaded_by: f.uploaded_by,
    created_at: f.created_at.toISOString(),
    users: f.users,
  }));

  return (
    <div className="p-4 md:p-6 mx-auto max-w-3xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="flex items-start gap-3">
          <Button variant="ghost" size="icon" asChild className="shrink-0 mt-0.5">
            <Link href="/contracts" aria-label="Zpět na seznam">
              <ArrowLeft className="h-5 w-5" />
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold tracking-tight pr-2">{contract.title}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge variant={statusVariant(contract.approval_status)}>
                {contractStatusLabel(contract.approval_status)}
              </Badge>
              {contract.contract_types && (
                <span className="text-sm text-muted-foreground">
                  {contract.contract_types.name}
                  {contract.contract_types.code ? ` (${contract.contract_types.code})` : ""}
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap gap-2 sm:justify-end">
          {canEdit && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/contracts/${id}/edit`}>
                <Pencil className="mr-2 h-4 w-4" />
                Upravit
              </Link>
            </Button>
          )}
          {canDelete && <DeleteContractButton contractId={id} />}
        </div>
      </div>

      <ContractApprovalPanel
        contractId={id}
        title={contract.title}
        approvalStatus={contract.approval_status}
        currentUserId={userId}
        createdBy={contract.created_by}
        isAdmin={admin}
        pendingApproverId={pending?.approver_id ?? null}
      />

      <ContractLifecyclePanel
        contractId={id}
        approvalStatus={contract.approval_status}
        canManage={canManage}
      />

      <ContractAttachments
        contractId={id}
        initialFiles={initialFiles}
        canUpload={canUploadFiles}
        currentUserId={userId}
        isAdmin={admin}
        createdBy={contract.created_by}
        responsibleUserId={contract.responsible_user_id}
        readOnly={readOnlyArchived}
      />

      <div
        className="rounded-xl border bg-card p-4 md:p-6 shadow-sm space-y-4"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
          Údaje
        </h2>
        <dl className="grid gap-3 sm:grid-cols-2 text-sm">
          <div>
            <dt className="text-muted-foreground">Číslo / ID</dt>
            <dd>{contract.contract_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Autor</dt>
            <dd>
              {contract.users_created_by
                ? `${contract.users_created_by.first_name} ${contract.users_created_by.last_name}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Strana – firma</dt>
            <dd>{contract.party_company ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Strana – kontakt</dt>
            <dd>{contract.party_contact ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Odpovědná osoba</dt>
            <dd>
              {contract.users_responsible
                ? `${contract.users_responsible.first_name} ${contract.users_responsible.last_name}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Oddělení</dt>
            <dd>{contract.departments?.name ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-muted-foreground">Hodnota</dt>
            <dd>
              {contract.value_amount != null
                ? `${contract.value_amount.toString()} ${contract.value_currency ?? "CZK"}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Účinnost od</dt>
            <dd>{fmtDay(contract.effective_from)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Platnost do</dt>
            <dd>{fmtDay(contract.valid_until)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Expirace</dt>
            <dd>{fmtDay(contract.expires_at)}</dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Podpis</dt>
            <dd>{fmtDay(contract.signed_at)}</dd>
          </div>
        </dl>
        {contract.description && (
          <div className="pt-2 border-t" style={{ borderColor: "var(--border)" }}>
            <p className="text-sm text-muted-foreground mb-1">Popis</p>
            <p className="whitespace-pre-wrap text-sm">{contract.description}</p>
          </div>
        )}
      </div>

      <div
        className="rounded-xl border bg-card p-4 md:p-6 shadow-sm"
        style={{ borderColor: "var(--border)" }}
      >
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-4">
          Schvalování
        </h2>
        {contract.contract_approvals.length === 0 ? (
          <p className="text-sm text-muted-foreground">Zatím žádné kroky.</p>
        ) : (
          <ul className="space-y-3">
            {contract.contract_approvals.map((a) => (
              <li
                key={a.id}
                className="flex flex-wrap items-baseline justify-between gap-2 border-b pb-3 last:border-0"
                style={{ borderColor: "var(--border)" }}
              >
                <div>
                  <span className="font-medium">
                    Krok {a.approval_order}: {a.users?.first_name} {a.users?.last_name}
                  </span>
                  <span className="text-muted-foreground text-sm ml-2">
                    ({a.approval_type ?? "—"})
                  </span>
                </div>
                <div className="text-sm">
                  <Badge variant={a.status === "rejected" ? "destructive" : "secondary"}>
                    {a.status === "pending"
                      ? "Čeká"
                      : a.status === "approved"
                        ? "Schváleno"
                        : a.status === "rejected"
                          ? "Zamítnuto"
                          : (a.status ?? "—")}
                  </Badge>
                  {a.approved_at && (
                    <span className="text-muted-foreground ml-2">{fmtDate(a.approved_at)}</span>
                  )}
                </div>
                {a.comment && (
                  <p className="w-full text-sm text-muted-foreground mt-1">{a.comment}</p>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        Vytvořeno: {fmtDate(contract.created_at)} · Upraveno: {fmtDate(contract.updated_at)}
      </p>
    </div>
  );
}
