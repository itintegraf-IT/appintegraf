import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { userCanViewUkol, userCanEditUkol, userCanCompleteUkol } from "@/lib/ukoly-access";
import { DeleteUkolButton } from "./DeleteUkolButton";
import { EditUkolForm } from "./EditUkolForm";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { ukolStatusBadgeClass, ukolStatusLabel } from "@/lib/ukoly-status";
import { CompleteUkolButton } from "./CompleteUkolButton";
import { StartUkolButton } from "./StartUkolButton";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ id: string }> };

export default async function UkolyDetailPage({ params }: PageProps) {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    redirect("/");
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) notFound();

  if (!(await userCanViewUkol(userId, id))) {
    notFound();
  }

  const ukol = await prisma.ukoly.findUnique({
    where: { id },
    include: {
      users_assignee: { select: { first_name: true, last_name: true, id: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      ukoly_departments: { include: { departments: { select: { id: true, name: true } } } },
    },
  });

  if (!ukol) notFound();

  const canEdit = await userCanEditUkol(userId, id);
  const canComplete = await userCanCompleteUkol(userId, id);

  const departments = await prisma.departments.findMany({
    where: { is_active: true, display_in_list: true },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  const users = await prisma.users.findMany({
    where: { is_active: true },
    orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
    select: {
      id: true,
      first_name: true,
      last_name: true,
      department_id: true,
      user_secondary_departments: { select: { department_id: true } },
    },
    take: 500,
  });

  const initialEdit = {
    body: ukol.body,
    order_number: ukol.order_number,
    due_at: new Date(ukol.due_at).toISOString(),
    urgent: ukol.urgent,
    assignee_user_id: ukol.assignee_user_id,
    status: ukol.status,
    department_ids: ukol.ukoly_departments.map((x) => x.department_id),
  };

  return (
    <div>
      <Link href="/ukoly" className="mb-4 inline-block text-sm text-red-600 hover:underline">
        ← Zpět na přehled
      </Link>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h2 className="text-xl font-semibold text-gray-900">Detail úkolu #{ukol.id}</h2>
            <p className="mt-1 text-sm text-gray-500">
              Zadal/a: {ukol.users_creator.first_name} {ukol.users_creator.last_name} ·{" "}
              {formatDateTimeCz(new Date(ukol.assigned_at))}
            </p>
          </div>
          <div className="flex gap-2">
            {canComplete && ukol.status === "open" && <StartUkolButton id={ukol.id} />}
            {canComplete && ukol.status !== "done" && ukol.status !== "cancelled" && (
              <CompleteUkolButton id={ukol.id} />
            )}
            {canEdit && <DeleteUkolButton id={ukol.id} />}
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Termín splnění</dt>
            <dd className="mt-1 text-gray-900">
              {formatDateTimeCz(new Date(ukol.due_at))}
              {ukol.urgent && (
                <span className="ml-2 rounded bg-amber-100 px-2 text-xs text-amber-900">urgentní</span>
              )}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Zakázka</dt>
            <dd className="mt-1 text-gray-900">{ukol.order_number ?? "—"}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Odpovědná osoba</dt>
            <dd className="mt-1 text-gray-900">
              {ukol.users_assignee
                ? `${ukol.users_assignee.first_name} ${ukol.users_assignee.last_name}`
                : "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Oddělení</dt>
            <dd className="mt-1 text-gray-900">
              {ukol.ukoly_departments.map((x) => x.departments.name).join(", ") || "—"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase text-gray-500">Stav</dt>
            <dd className="mt-1 text-gray-900">
              <span
                className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${ukolStatusBadgeClass(ukol.status)}`}
              >
                {ukolStatusLabel(ukol.status)}
              </span>
            </dd>
          </div>
          {ukol.attachment_path && (
            <div className="sm:col-span-2">
              <dt className="text-xs font-medium uppercase text-gray-500">Příloha</dt>
              <dd className="mt-1">
                <a
                  href={ukol.attachment_path}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-red-600 hover:underline"
                >
                  {ukol.attachment_original_name ?? "Stáhnout soubor"}
                </a>
              </dd>
            </div>
          )}
        </dl>

        <div className="mt-6 border-t border-gray-100 pt-6">
          <h3 className="text-sm font-medium text-gray-700">Zadání</h3>
          <p className="mt-2 whitespace-pre-wrap text-gray-900">{ukol.body}</p>
        </div>
      </div>

      {canEdit && (
        <EditUkolForm id={ukol.id} initial={initialEdit} departments={departments} users={users} />
      )}
    </div>
  );
}
