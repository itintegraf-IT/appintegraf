import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";
import { userCanViewMaketa, userCanEditMaketa, userCanCompleteMaketa } from "@/lib/makety-access";
import { DeleteMaketaButton } from "./DeleteMaketaButton";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
} from "@/lib/makety-status";
import { CompleteMaketaButton } from "./CompleteMaketaButton";
import { StartMaketaButton } from "./StartMaketaButton";
import { MaketaFilesPanel } from "./MaketaFilesPanel";
import { MaketaCommentsPanel } from "./MaketaCommentsPanel";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ upload?: string }>;
};

export default async function MaketaDetailPage({ params, searchParams }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (
    !(await hasModuleAccess(userId, "makety", "read")) &&
    !(await hasMaketyVyrobaAccess(userId))
  ) {
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
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  if (!maketa) notFound();

  const canEdit = await userCanEditMaketa(userId, id);
  const canComplete = await userCanCompleteMaketa(userId, id);
  const isArchived = maketa.status === "done" || maketa.status === "cancelled";

  return (
    <div className="space-y-6">
      <Link href="/makety" className="inline-block text-sm text-violet-600 hover:underline">
        ← Zpět na přehled
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Maketa #{maketa.id}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Zadal/a: {maketa.users_creator.first_name} {maketa.users_creator.last_name} ·{" "}
              {formatDateTimeCz(new Date(maketa.assigned_at))}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canComplete && maketa.status === "open" && <StartMaketaButton id={maketa.id} />}
            {canComplete && !isArchived && <CompleteMaketaButton id={maketa.id} />}
            {canEdit && <DeleteMaketaButton id={maketa.id} />}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Stav</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(maketa.status)}`}
              >
                {maketaStatusLabel(maketa.status)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Priorita</dt>
            <dd className="mt-1">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaPriorityBadgeClass(maketa.priority)}`}
              >
                {maketaPriorityLabel(maketa.priority)}
              </span>
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Termín</dt>
            <dd className="mt-1 text-sm text-gray-900">{formatDateTimeCz(new Date(maketa.due_at))}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Zakázka</dt>
            <dd className="mt-1 text-sm text-gray-900">{maketa.order_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Materiál</dt>
            <dd className="mt-1 text-sm text-gray-900">{maketa.material ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Rozměr</dt>
            <dd className="mt-1 text-sm text-gray-900">{maketa.dimensions ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Počet kusů</dt>
            <dd className="mt-1 text-sm text-gray-900">{maketa.quantity ?? "—"}</dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-gray-500">Výroba (Výroba maket)</dt>
            <dd className="mt-1 text-sm text-gray-900">
              {maketa.users_assignee
                ? `${maketa.users_assignee.first_name} ${maketa.users_assignee.last_name}`
                : "—"}
            </dd>
          </div>
          <div className="sm:col-span-2">
            <dt className="text-xs font-medium uppercase text-gray-500">Popis</dt>
            <dd className="mt-1 whitespace-pre-wrap text-sm text-gray-900">{maketa.body}</dd>
          </div>
        </dl>
      </div>

      {!isArchived && (
        <MaketaFilesPanel maketaId={id} canDelete={canEdit} showUploadHint={showUploadHint} />
      )}

      <MaketaCommentsPanel maketaId={id} />
    </div>
  );
}
