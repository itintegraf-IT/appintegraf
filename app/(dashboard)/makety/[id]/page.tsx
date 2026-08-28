import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import {
  maketyAssigneeRoleLabel,
  maketyWorkTypeLabel,
  type MaketyWorkType,
} from "@/lib/makety-work-type";
import {
  userCanViewMaketa,
  userCanEditMaketa,
  userCanDeleteMaketa,
  userCanCompleteMaketa,
  userCanSubmitMaketaQuote,
  userCanApproveMaketaQuote,
  userCanOperateGrafikaAutomation,
  userCanCopyMaketa,
  canManageMaketyQueue,
  userCanDeleteMaketyFile,
} from "@/lib/makety-access";
import { MaketaQuoteForm } from "./MaketaQuoteForm";
import { MaketaApprovalPanel } from "./MaketaApprovalPanel";
import { MaketyDetailPrioritySelect } from "./MaketyDetailPrioritySelect";
import { MaketyDetailDataKindSelect } from "./MaketyDetailDataKindSelect";
import { DeleteMaketaButton } from "./DeleteMaketaButton";
import { CopyMaketaButton } from "./CopyMaketaButton";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
  isMaketaTerminalStatus,
  isGrafikaImlArchived,
} from "@/lib/makety-status";
import { maketyDataKindLabel } from "@/lib/makety-data-kind";
import { CompleteMaketaButton } from "./CompleteMaketaButton";
import { StartMaketaButton } from "./StartMaketaButton";
import { MaketaFilesPanel } from "./MaketaFilesPanel";
import { MaketaCommentsPanel } from "./MaketaCommentsPanel";
import { GrafikaStatusPanel } from "./GrafikaStatusPanel";
import { SoftproofLinkStatusBox } from "./SoftproofLinkStatusBox";
import { GrafikaAutomationPanel } from "./GrafikaAutomationPanel";
import { MaketyFileEventsPanel } from "./MaketyFileEventsPanel";
import { GrafikaWorkflowPicker } from "../GrafikaWorkflowPicker";
import { buildMaketyCommentParticipants } from "@/lib/makety-comment-participants";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
};

export default async function MaketaDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    redirect("/");
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  if (!(await userCanViewMaketa(userId, id))) {
    notFound();
  }

  const sp = await searchParams;
  const showUploadHint = sp.upload === "1";

  const maketa = await prisma.makety.findUnique({
    where: { id },
    include: {
      users_assignee: { select: { first_name: true, last_name: true, id: true } },
      users_creator: { select: { first_name: true, last_name: true, id: true } },
      users_prepress: { select: { first_name: true, last_name: true, id: true } },
      users_final_approver: { select: { first_name: true, last_name: true, id: true } },
      iml_customers: {
        select: {
          id: true,
          name: true,
          email: true,
          iml_customer_emails: {
            where: { is_primary: true },
            take: 1,
            select: { email: true },
          },
        },
      },
      iml_products: {
        select: {
          id: true,
          ig_code: true,
          client_code: true,
          ig_short_name: true,
          client_name: true,
        },
      },
      iml_die_cuts: {
        select: {
          id: true,
          label_shape_code: true,
          die_cut_tool_code: true,
          internal_name: true,
        },
      },
    },
  });

  if (!maketa) notFound();

  const workType = (maketa.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  const canEdit = await userCanEditMaketa(userId, id);
  const canDelete = await userCanDeleteMaketa(userId, id);
  const canCopy = await userCanCopyMaketa(userId, id);
  const canComplete = await userCanCompleteMaketa(userId, id);
  const canSubmitQuote = await userCanSubmitMaketaQuote(userId, id);
  const canApproveQuote = await userCanApproveMaketaQuote(userId, id);
  const isArchived =
    workType === "grafika"
      ? isGrafikaImlArchived(maketa.status, maketa.iml_applied_at)
      : isMaketaTerminalStatus(maketa.status, workType);
  const canDeleteFile = await userCanDeleteMaketyFile(userId, id);
  const canManagePriority =
    (await canManageMaketyQueue(userId)) && !isArchived;
  const canEditDataKind =
    workType === "grafika" && !isArchived && (canEdit || canManagePriority);
  const grafikaAutomation =
    workType === "grafika"
      ? await userCanOperateGrafikaAutomation(userId, id)
      : { allowed: false, viaOverride: false };
  const canGrafikaAutomation = grafikaAutomation.allowed;
  const softproofDefaultEmail =
    maketa.iml_customers?.email?.trim() ||
    maketa.iml_customers?.iml_customer_emails[0]?.email?.trim() ||
    null;
  const lastSoftproofLink =
    workType === "grafika"
      ? await prisma.makety_softproof_links.findFirst({
          where: { maketa_id: id },
          orderBy: { created_at: "desc" },
          select: {
            sent_to_email: true,
            expires_at: true,
            created_at: true,
            used_at: true,
            used_action: true,
            file_id: true,
            locale: true,
          },
        })
      : null;
  const clientSoftproofDecision =
    workType === "grafika"
      ? await prisma.makety_softproof_links.findFirst({
          where: {
            maketa_id: id,
            used_action: { in: ["approved", "rejected"] },
          },
          orderBy: { used_at: "desc" },
          select: {
            used_action: true,
            used_at: true,
            reject_reason: true,
            sent_to_email: true,
          },
        })
      : null;
  const commentParticipants = buildMaketyCommentParticipants({
    workType,
    excludeUserId: userId,
    creator: maketa.users_creator,
    assignee: maketa.users_assignee,
    prepress: maketa.users_prepress,
    finalApprover: maketa.users_final_approver,
  });
  const quotePriceFormatted =
    maketa.quote_price != null
      ? new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK" }).format(
          Number(maketa.quote_price)
        )
      : null;
  const showApprovedQuote =
    workType === "maketa" &&
    maketa.quote_price != null &&
    maketa.status !== "awaiting_quote" &&
    maketa.status !== "quote_submitted";

  return (
    <div className="space-y-6">
      <Link href="/makety" className="inline-block text-sm text-violet-600 hover:underline">
        ← Zpět na přehled
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">
                  {maketyWorkTypeLabel(workType)} #{maketa.id}
                </h2>
                <p className="mt-1 text-sm text-gray-500">
                  Zadal/a: {maketa.users_creator.first_name} {maketa.users_creator.last_name} ·{" "}
                  {formatDateTimeCz(new Date(maketa.assigned_at))}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {canCopy && <CopyMaketaButton id={maketa.id} />}
                {canEdit && (
                  <Link
                    href={`/makety/${maketa.id}/edit`}
                    className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-medium text-violet-700 hover:bg-violet-50"
                  >
                    Upravit
                  </Link>
                )}
                {canComplete && workType === "maketa" && maketa.status === "open" && (
                  <StartMaketaButton id={maketa.id} />
                )}
                {canComplete && workType === "maketa" && !isArchived && (
                  <CompleteMaketaButton id={maketa.id} />
                )}
                {canDelete && <DeleteMaketaButton id={maketa.id} isAdmin={!canEdit && canDelete} />}
              </div>
            </div>

            <dl className="mt-6 grid gap-4 sm:grid-cols-2">
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Stav</dt>
                <dd className="mt-1">
                  <span
                    className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(maketa.status, workType)}`}
                  >
                    {maketaStatusLabel(maketa.status, workType)}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Typ</dt>
                <dd className="mt-1 text-sm text-gray-900">{maketyWorkTypeLabel(workType)}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Priorita</dt>
                {canManagePriority ? (
                  <MaketyDetailPrioritySelect maketaId={maketa.id} initialPriority={maketa.priority} />
                ) : (
                  <dd className="mt-1">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaPriorityBadgeClass(maketa.priority)}`}
                    >
                      {maketaPriorityLabel(maketa.priority)}
                    </span>
                  </dd>
                )}
              </div>
              {workType === "grafika" && (
                <div>
                  <dt className="text-xs font-medium uppercase text-gray-500">Typ dat</dt>
                  {canEditDataKind ? (
                    <MaketyDetailDataKindSelect
                      maketaId={maketa.id}
                      initialDataKind={maketa.data_kind}
                    />
                  ) : (
                    <dd className="mt-1 text-sm text-gray-900">
                      {maketyDataKindLabel(maketa.data_kind)}
                    </dd>
                  )}
                </div>
              )}
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Termín</dt>
                <dd className="mt-1 text-sm text-gray-900">{formatDateTimeCz(new Date(maketa.due_at))}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Zakázka</dt>
                <dd className="mt-1 text-sm text-gray-900">{maketa.order_number ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs font-medium uppercase text-gray-500">Počet kusů</dt>
                <dd className="mt-1 text-sm text-gray-900">{maketa.quantity ?? "—"}</dd>
              </div>
              {workType === "grafika" && (
                <>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Klient</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {maketa.iml_customers ? maketa.iml_customers.name : "—"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Název (IML)</dt>
                    <dd className="mt-1 text-sm text-gray-900">{maketa.product_name ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Číslo zakázky (ERP)</dt>
                    <dd className="mt-1 text-sm text-gray-900">{maketa.job_number ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Kód etikety</dt>
                    <dd className="mt-1 text-sm text-gray-900">{maketa.label_code ?? "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Etiketa v katalogu</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {maketa.iml_products ? (
                        <Link
                          href={`/iml/products/${maketa.iml_products.id}`}
                          className="font-medium text-violet-600 hover:underline"
                        >
                          {maketa.iml_products.ig_code ||
                            maketa.iml_products.client_code ||
                            `#${maketa.iml_products.id}`}
                          {(maketa.iml_products.ig_short_name ||
                            maketa.iml_products.client_name) &&
                            ` — ${
                              maketa.iml_products.ig_short_name ||
                              maketa.iml_products.client_name
                            }`}
                        </Link>
                      ) : (
                        "—"
                      )}
                    </dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-gray-500">Výsek</dt>
                    <dd className="mt-1 text-sm text-gray-900">
                      {maketa.iml_die_cuts
                        ? [
                            maketa.iml_die_cuts.label_shape_code,
                            maketa.iml_die_cuts.die_cut_tool_code,
                            maketa.iml_die_cuts.internal_name,
                          ]
                            .filter(Boolean)
                            .join(" · ")
                        : "—"}
                    </dd>
                  </div>
                </>
              )}
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">
                  {maketyAssigneeRoleLabel(workType)}
                </dt>
                <dd className="mt-1 text-sm text-gray-900">
                  {maketa.users_assignee
                    ? `${maketa.users_assignee.first_name} ${maketa.users_assignee.last_name}`
                    : "—"}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-xs font-medium uppercase text-gray-500">Popis zadání</dt>
                <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{maketa.body}</dd>
              </div>
              {showApprovedQuote && quotePriceFormatted && (
                <>
                  <div>
                    <dt className="text-xs font-medium uppercase text-gray-500">Schválená cena</dt>
                    <dd className="mt-1 text-sm font-medium text-gray-900">{quotePriceFormatted}</dd>
                  </div>
                  <div className="sm:col-span-2">
                    <dt className="text-xs font-medium uppercase text-gray-500">
                      Popis výroby (výrobce)
                    </dt>
                    <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">
                      {maketa.quote_production_description ?? "—"}
                    </dd>
                  </div>
                </>
              )}
            </dl>
          </div>

          {workType === "grafika" && (
            <div className="w-full shrink-0 sm:w-auto sm:max-w-xs">
              <GrafikaStatusPanel
                maketaId={id}
                initialStatus={maketa.status}
                defaultClientEmail={softproofDefaultEmail}
                canResendSoftproof={
                  canGrafikaAutomation && maketa.status === "sent_for_approval"
                }
                softproofViaOverride={grafikaAutomation.viaOverride}
                lastSoftproofPrefill={
                  lastSoftproofLink
                    ? {
                        toEmail: lastSoftproofLink.sent_to_email,
                        fileId: lastSoftproofLink.file_id,
                        locale: lastSoftproofLink.locale,
                      }
                    : null
                }
              />
            </div>
          )}
        </div>

        {workType === "grafika" &&
          maketa.status === "sent_for_approval" &&
          lastSoftproofLink && (
            <div className="mt-4">
              <SoftproofLinkStatusBox link={lastSoftproofLink} />
            </div>
          )}

        {workType === "grafika" && (
          <div className="mt-6">
            <GrafikaWorkflowPicker
              mode="readonly"
              currentStatus={maketa.status}
              creatorName={`${maketa.users_creator.first_name} ${maketa.users_creator.last_name}`}
              grafikUsers={[]}
              prepressUsers={[]}
              finalUsers={[]}
              initial={{
                assignee_user_id: maketa.assignee_user_id,
                prepress_user_id: maketa.prepress_user_id,
                final_approver_user_id: maketa.final_approver_user_id,
              }}
              assigneeDisplayName={
                maketa.users_assignee
                  ? `${maketa.users_assignee.first_name} ${maketa.users_assignee.last_name}`
                  : null
              }
              prepressDisplayName={
                maketa.users_prepress
                  ? `${maketa.users_prepress.first_name} ${maketa.users_prepress.last_name}`
                  : null
              }
              finalDisplayName={
                maketa.users_final_approver
                  ? `${maketa.users_final_approver.first_name} ${maketa.users_final_approver.last_name}`
                  : null
              }
            />
          </div>
        )}
      </div>

      {clientSoftproofDecision?.used_action === "approved" && (
        <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-900 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          Klient schválil softproof
          {clientSoftproofDecision.sent_to_email
            ? ` (${clientSoftproofDecision.sent_to_email})`
            : ""}
          . Stav zakázky se nemění — finální schválení dokončete ve workflow.
        </div>
      )}
      {clientSoftproofDecision?.used_action === "rejected" && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100">
          <p>
            Klient zamítl softproof
            {clientSoftproofDecision.sent_to_email
              ? ` (${clientSoftproofDecision.sent_to_email})`
              : ""}
            .
          </p>
          {clientSoftproofDecision.reject_reason && (
            <p className="mt-1 whitespace-pre-wrap">
              Důvod: {clientSoftproofDecision.reject_reason}
            </p>
          )}
        </div>
      )}

      {workType === "maketa" && canSubmitQuote && (
        <MaketaQuoteForm maketaId={id} rejectionReason={maketa.rejection_reason} />
      )}

      {workType === "maketa" &&
        canApproveQuote &&
        maketa.status === "quote_submitted" &&
        quotePriceFormatted &&
        maketa.quote_production_description && (
          <MaketaApprovalPanel
            maketaId={id}
            quotePrice={quotePriceFormatted}
            quoteProductionDescription={maketa.quote_production_description}
          />
        )}

      {!isArchived && (
        <MaketaFilesPanel
          maketaId={id}
          canDelete={canDeleteFile}
          showUploadHint={showUploadHint}
          uploadHintText={
            workType === "grafika"
              ? "Nejdřív vyberte typ souboru (softproof / tisková data / jiné), pak nahrajte přílohy."
              : "Nejdřív vyberte typ souboru, pak nahrajte podklady pro výrobu makety."
          }
        />
      )}

      {workType === "grafika" && <MaketyFileEventsPanel maketaId={id} />}

      {workType === "grafika" && canGrafikaAutomation && (
        <GrafikaAutomationPanel
          maketaId={id}
          canOperate={canGrafikaAutomation}
          status={maketa.status}
          hasCustomer={maketa.customer_id != null}
          hasProduct={maketa.product_id != null}
          imlApplied={maketa.iml_applied_at != null}
        />
      )}

      <MaketaCommentsPanel
        maketaId={id}
        participants={commentParticipants}
        redirectToListAfterSubmit={showUploadHint}
      />
    </div>
  );
}
