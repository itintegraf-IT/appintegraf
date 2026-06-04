import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasMaketyGrafikaAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";
import { buildMaketyListWhere } from "@/lib/makety-access";
import { maketyWorkTypeLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { formatDateTimeCz } from "@/lib/datetime-cz";
import {
  maketaPriorityBadgeClass,
  maketaPriorityLabel,
  maketaStatusBadgeClass,
  maketaStatusLabel,
} from "@/lib/makety-status";

export const dynamic = "force-dynamic";

export default async function MaketyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    term?: string;
    created?: string;
    grafika_created?: string;
    comment_sent?: string;
    completed?: string;
  }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const params = await searchParams;
  const selectedStatus =
    params.status === "open" ||
    params.status === "in_progress" ||
    params.status === "done" ||
    params.status === "cancelled"
      ? params.status
      : "";
  const selectedTerm =
    params.term === "overdue" || params.term === "today" || params.term === "week"
      ? params.term
      : "";
  const created = params.created === "1";
  const grafikaCreated = params.grafika_created === "1";
  const commentSent = params.comment_sent === "1";
  const completed = params.completed === "1";
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const endOfToday = new Date(startOfToday);
  endOfToday.setHours(23, 59, 59, 999);
  const endOfWeek = new Date(startOfToday);
  endOfWeek.setDate(endOfWeek.getDate() + 7);
  endOfWeek.setHours(23, 59, 59, 999);

  const statusFilter: Record<string, unknown> = selectedStatus
    ? { status: selectedStatus }
    : { status: { notIn: ["done", "cancelled"] } };
  const where = await buildMaketyListWhere(userId, statusFilter);
  if (selectedTerm === "overdue") {
    where.due_at = { lt: now };
  } else if (selectedTerm === "today") {
    where.due_at = { gte: startOfToday, lte: endOfToday };
  } else if (selectedTerm === "week") {
    where.due_at = { gte: startOfToday, lte: endOfWeek };
  }

  const rows = await prisma.makety.findMany({
    where,
    orderBy: { due_at: "asc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  const statusOrder = ["open", "in_progress", "done", "cancelled"] as const;
  const grouped = statusOrder.map((status) => ({
    status,
    label: maketaStatusLabel(status),
    items: rows.filter((r) => r.status === status),
  }));

  const showVyrobaHint = await hasMaketyVyrobaAccess(userId);
  const showGrafikaHint = await hasMaketyGrafikaAccess(userId);

  return (
    <div className="space-y-5">
      {created && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Maketa byla úspěšně vytvořena.
        </div>
      )}
      {grafikaCreated && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Zakázka grafiky byla úspěšně vytvořena.
        </div>
      )}
      {commentSent && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Komentář byl odeslán. Zakázka je zapsaná v přehledu.
        </div>
      )}
      {completed && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          Maketa byla dokončena a přesunuta do archivu.
        </div>
      )}
      {showVyrobaHint && (
        <p className="text-sm text-gray-600">
          Jako výroba maket máte přístup k{" "}
          <Link href="/makety/kalendar" className="font-medium text-violet-600 hover:underline">
            kalendáři maket
          </Link>
          .
        </p>
      )}
      {showGrafikaHint && (
        <p className="text-sm text-gray-600">
          Jako grafika máte přístup k{" "}
          <Link href="/makety/kalendar-grafika" className="font-medium text-violet-600 hover:underline">
            kalendáři grafiky
          </Link>
          .
        </p>
      )}

      <form className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Stav</label>
            <select
              name="status"
              defaultValue={selectedStatus}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Aktivní</option>
              <option value="open">{maketaStatusLabel("open")}</option>
              <option value="in_progress">{maketaStatusLabel("in_progress")}</option>
              <option value="done">{maketaStatusLabel("done")}</option>
              <option value="cancelled">{maketaStatusLabel("cancelled")}</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Termín</label>
            <select
              name="term"
              defaultValue={selectedTerm}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Bez omezení</option>
              <option value="overdue">Po termínu</option>
              <option value="today">Dnes</option>
              <option value="week">Do 7 dní</option>
            </select>
          </div>
          <div className="flex items-end gap-2">
            <button
              type="submit"
              className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
            >
              Filtrovat
            </button>
            <Link
              href="/makety"
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Reset
            </Link>
          </div>
        </div>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((g) => (
          <div key={g.status} className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-2 flex items-center justify-between">
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(g.status)}`}
              >
                {g.label}
              </span>
              <span className="text-sm font-semibold text-gray-700">{g.items.length}</span>
            </div>
            <div className="space-y-1">
              {g.items.slice(0, 3).map((r) => (
                <Link
                  key={r.id}
                  href={`/makety/${r.id}`}
                  className="block truncate text-sm text-gray-700 hover:text-violet-600"
                >
                  #{r.id} {r.order_number ? `· ${r.order_number}` : ""}{" "}
                  {r.body.replace(/\s+/g, " ").trim().slice(0, 28)}
                </Link>
              ))}
              {g.items.length === 0 && <p className="text-xs text-gray-400">Žádné záznamy</p>}
            </div>
          </div>
        ))}
      </section>

      <div className="overflow-x-auto rounded-xl border border-gray-200 bg-white shadow-sm">
        <table className="min-w-full text-left text-sm">
          <thead className="border-b border-gray-200 bg-gray-50">
            <tr>
              <th className="px-4 py-3 font-semibold text-gray-700">Termín</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Typ</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Zakázka</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Popis</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Přiřazeno</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Priorita</th>
              <th className="px-4 py-3 font-semibold text-gray-700">Stav</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-4 py-10 text-center text-gray-500">
                  Žádné zakázky k zobrazení.
                </td>
              </tr>
            ) : (
              rows.map((r) => {
                const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
                return (
                <tr key={r.id} className="border-b border-gray-100 hover:bg-gray-50/80">
                  <td className="px-4 py-3 text-gray-800">{formatDateTimeCz(new Date(r.due_at))}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700">
                      {maketyWorkTypeLabel(wt)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-700">{r.order_number ?? "—"}</td>
                  <td className="max-w-xs px-4 py-3">
                    <Link href={`/makety/${r.id}`} className="font-medium text-violet-600 hover:underline">
                      {r.body.replace(/\s+/g, " ").trim().slice(0, 80)}
                      {r.body.length > 80 ? "…" : ""}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {r.users_assignee
                      ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}`
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${maketaPriorityBadgeClass(r.priority)}`}
                    >
                      {maketaPriorityLabel(r.priority)}
                    </span>
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
