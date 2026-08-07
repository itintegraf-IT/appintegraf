import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { buildMaketyListWhere, canViewAllMaketyTypes } from "@/lib/makety-access";
import { MaketyAdminRowActions } from "../MaketyAdminRowActions";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
  isMaketaTerminalStatus,
  maketyArchiveWhereClause,
} from "@/lib/makety-status";

export const dynamic = "force-dynamic";

export default async function MaketyArchivePage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canModuleAdmin = await canViewAllMaketyTypes(userId);
  const where = await buildMaketyListWhere(userId, maketyArchiveWhereClause());

  const rows = await prisma.makety.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Hotové a zrušené zakázky (makety i grafika).</p>
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
              {canModuleAdmin && (
                <th className="px-4 py-3 font-semibold text-gray-700">Akce</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={canModuleAdmin ? 7 : 6} className="px-4 py-10 text-center text-gray-500">
                  Archiv je prázdný.
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
                    <Link href={`/makety/${r.id}`} className="text-violet-600 hover:underline">
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
                      {maketaStatusLabel(r.status, wt)}
                    </span>
                  </td>
                  {canModuleAdmin && (
                    <td className="px-4 py-3">
                      <MaketyAdminRowActions
                        id={r.id}
                        priority={r.priority}
                        status={r.status}
                        showPriority={false}
                      />
                    </td>
                  )}
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
