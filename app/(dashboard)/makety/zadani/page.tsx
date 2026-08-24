import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewAllMaketyTypes, canZadatAnyMaketyWork, canZadatMaketyWork } from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { maketaStatusBadgeClass, maketaStatusLabel } from "@/lib/makety-status";
import { MaketyAdminRowActions } from "../MaketyAdminRowActions";

export const dynamic = "force-dynamic";

export default async function MaketyZadaniPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const orgWide = await canViewAllMaketyTypes(userId);
  const canWriteAny = await canZadatAnyMaketyWork(userId);
  const canWriteMaketa = await canZadatMaketyWork(userId, "maketa");
  const canWriteGrafika = await canZadatMaketyWork(userId, "grafika");
  if (!canWriteAny && !orgWide) {
    redirect("/makety");
  }
  const listWhere = orgWide
    ? { status: { notIn: ["cancelled"] } }
    : { created_by: userId, status: { notIn: ["cancelled"] } };

  const rows = await prisma.makety.findMany({
    where: listWhere,
    orderBy: { due_at: "asc" },
    take: 200,
    select: {
      id: true,
      body: true,
      order_number: true,
      due_at: true,
      work_type: true,
      status: true,
      priority: true,
      created_by: true,
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  const colSpan = orgWide ? 8 : 7;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        {orgWide
          ? "Přehled všech zadaných zakázek (makety i grafika)."
          : "Přehled maket, které jste zadali."}
      </p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Termín</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Typ</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Popis</th>
              {orgWide && (
                <th className="px-4 py-3 font-semibold text-gray-700">Zadal</th>
              )}
              <th className="px-4 py-3 font-semibold text-gray-700">Přiřazeno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Akce</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-10 text-center text-gray-500">
                  Zatím nemáte žádné zadané zakázky.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
                const canEditRow =
                  (wt === "grafika" ? canWriteGrafika : canWriteMaketa) &&
                  r.created_by === userId &&
                  r.status !== "done" &&
                  r.status !== "cancelled";
                return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3">{formatDateTimeCz(new Date(r.due_at))}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {maketyWorkTypeLabel(wt)}
                    </span>
                  </td>
                  <td className="px-4 py-3">{r.order_number ?? "—"}</td>
                  <td className="px-4 py-3">
                    <Link href={`/makety/${r.id}`} className="font-medium text-violet-600 hover:underline">
                      {r.body.replace(/\s+/g, " ").trim().slice(0, 80)}
                    </Link>
                  </td>
                  {orgWide && (
                    <td className="px-4 py-3 text-gray-700">
                      {r.users_creator
                        ? `${r.users_creator.first_name} ${r.users_creator.last_name}`
                        : "—"}
                    </td>
                  )}
                  <td className="px-4 py-3">
                    {r.users_assignee
                      ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(
                        r.status,
                        (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType
                      )}`}
                    >
                      {maketaStatusLabel(
                        r.status,
                        (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType
                      )}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap items-center gap-2">
                      {canEditRow && (
                        <Link
                          href={`/makety/${r.id}/edit`}
                          className="text-sm font-medium text-violet-600 hover:underline"
                        >
                          Upravit
                        </Link>
                      )}
                      {orgWide ? (
                        <MaketyAdminRowActions
                          id={r.id}
                          priority={r.priority}
                          status={r.status}
                        />
                      ) : (
                        !canEditRow && <span className="text-gray-400">—</span>
                      )}
                    </div>
                  </td>
                </tr>
              );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
