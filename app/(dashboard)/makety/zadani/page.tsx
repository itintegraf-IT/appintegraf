import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canViewAllMaketyTypes } from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { maketaStatusBadgeClass, maketaStatusLabel } from "@/lib/makety-status";

export const dynamic = "force-dynamic";

export default async function MaketyZadaniPage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "makety", "write"))) {
    redirect("/makety");
  }

  const orgWide = await canViewAllMaketyTypes(userId);
  const listWhere = orgWide
    ? { status: { notIn: ["cancelled"] } }
    : { created_by: userId, status: { notIn: ["cancelled"] } };

  const rows = await prisma.makety.findMany({
    where: listWhere,
    orderBy: { due_at: "asc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Přehled maket, které jste zadali.</p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Termín</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Typ</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Popis</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Přiřazeno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-gray-500">
                  Zatím nemáte žádné zadané zakázky.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
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
                  <td className="px-4 py-3">
                    {r.users_assignee
                      ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(r.status)}`}
                    >
                      {maketaStatusLabel(r.status)}
                    </span>
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
