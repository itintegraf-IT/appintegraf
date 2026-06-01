import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canViewAllMakety } from "@/lib/makety-access";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import { maketaStatusBadgeClass, maketaStatusLabel } from "@/lib/makety-status";

export const dynamic = "force-dynamic";

export default async function MaketyArchivePage() {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const orgWide = await canViewAllMakety(userId);

  const rows = await prisma.makety.findMany({
    where: {
      status: { in: ["done", "cancelled"] },
      ...(orgWide ? {} : { OR: [{ created_by: userId }, { assignee_user_id: userId }] }),
    },
    orderBy: { updated_at: "desc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
    },
  });

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">Hotové a zrušené makety.</p>
      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Termín</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Popis</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Výroba</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-gray-500">
                  Archiv je prázdný.
                </td>
              </tr>
            ) : (
              rows.map((r) => (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3">{formatDateTimeCz(new Date(r.due_at))}</td>
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
                      {maketaStatusLabel(r.status)}
                    </span>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
