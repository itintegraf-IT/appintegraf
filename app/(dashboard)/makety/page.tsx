import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import type { Prisma } from "@prisma/client";
import { hasMaketyGrafikaAccess, hasMaketyVyrobaAccess } from "@/lib/auth-utils";
import {
  applyWorkTypeToWhere,
  buildMaketyListWhere,
  canViewAllMaketyTypes,
  canZadatAnyMaketyWork,
  canZadatMaketyWork,
} from "@/lib/makety-access";
import { sortMaketyOverviewByPriority } from "@/lib/makety-queue";
import {
  isMaketyWorkType,
  type MaketyWorkType,
} from "@/lib/makety-work-type";
import {
  maketaStatusBadgeClass,
  maketaStatusLabel,
  isGrafikaImlArchived,
  type MaketaPriority,
} from "@/lib/makety-status";
import type { MaketyListRow } from "@/lib/makety/makety-list-columns";
import { MaketyActiveTableClient } from "./_components/MaketyActiveTableClient";

export const dynamic = "force-dynamic";

const STATUS_ORDER = [
  "awaiting_quote",
  "quote_submitted",
  "open",
  "in_progress",
  "data_problem",
  "done",
  "prepress_approved",
  "sent_for_approval",
  "approved",
  "cancelled",
] as const;
type MaketaStatus = (typeof STATUS_ORDER)[number];

function applyTermToWhere(
  where: Prisma.maketyWhereInput,
  term: "" | "overdue" | "today" | "week",
  bounds: { now: Date; startOfToday: Date; endOfToday: Date; endOfWeek: Date }
): void {
  if (term === "overdue") {
    where.due_at = { lt: bounds.now };
  } else if (term === "today") {
    where.due_at = { gte: bounds.startOfToday, lte: bounds.endOfToday };
  } else if (term === "week") {
    where.due_at = { gte: bounds.startOfToday, lte: bounds.endOfWeek };
  }
}

function buildListQuery(
  term: string,
  status?: string,
  workType?: string,
  extra?: { q?: string; priority?: string }
): string {
  const p = new URLSearchParams();
  if (workType) p.set("work_type", workType);
  if (term) p.set("term", term);
  if (status) p.set("status", status);
  if (extra?.q) p.set("q", extra.q);
  if (extra?.priority) p.set("priority", extra.priority);
  const q = p.toString();
  return q ? `/makety?${q}` : "/makety";
}

function workTypeToggleClass(active: boolean): string {
  return `rounded-lg border px-4 py-2 text-sm font-medium ${
    active
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
  }`;
}

export default async function MaketyListPage({
  searchParams,
}: {
  searchParams: Promise<{
    status?: string;
    term?: string;
    work_type?: string;
    created?: string;
    grafika_created?: string;
    comment_sent?: string;
    completed?: string;
    q?: string;
    priority?: string;
  }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canWriteMaketa = await canZadatMaketyWork(userId, "maketa");
  const canWriteGrafika = await canZadatMaketyWork(userId, "grafika");
  const canModuleAdmin = await canViewAllMaketyTypes(userId);
  const params = await searchParams;
  const selectedStatus: MaketaStatus | "" = STATUS_ORDER.includes(params.status as MaketaStatus)
    ? (params.status as MaketaStatus)
    : "";
  const selectedTerm =
    params.term === "overdue" || params.term === "today" || params.term === "week"
      ? params.term
      : "";
  const rawWorkType = params.work_type ?? "";
  const selectedWorkType: MaketyWorkType | "" = isMaketyWorkType(rawWorkType) ? rawWorkType : "";
  const searchQ = (params.q ?? "").trim();
  const selectedPriority: MaketaPriority | "" =
    params.priority === "urgent" || params.priority === "high" || params.priority === "normal"
      ? params.priority
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
  const termBounds = { now, startOfToday, endOfToday, endOfWeek };

  const baseWhere = await buildMaketyListWhere(userId, {});
  applyTermToWhere(baseWhere, selectedTerm, termBounds);
  if (selectedWorkType) applyWorkTypeToWhere(baseWhere, [selectedWorkType]);
  if (selectedPriority) baseWhere.priority = selectedPriority;
  if (searchQ) {
    const idRaw = searchQ.replace(/^#/, "").trim();
    const idNum = parseInt(idRaw, 10);
    const or: Prisma.maketyWhereInput[] = [
      { label_code: { contains: searchQ } },
      { job_number: { contains: searchQ } },
      { order_number: { contains: searchQ } },
    ];
    if (!Number.isNaN(idNum) && String(idNum) === idRaw) {
      or.push({ id: idNum });
    }
    const existingAnd = Array.isArray(baseWhere.AND)
      ? baseWhere.AND
      : baseWhere.AND
        ? [baseWhere.AND]
        : [];
    baseWhere.AND = [...existingAnd, { OR: or }];
  }

  const allForTermRaw = await prisma.makety.findMany({
    where: baseWhere,
    take: 500,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      iml_customers: { select: { id: true, name: true } },
    },
  });
  const allForTerm = sortMaketyOverviewByPriority(allForTermRaw);

  const statusCards = selectedWorkType === "grafika"
    ? STATUS_ORDER.filter((s) => s !== "awaiting_quote" && s !== "quote_submitted")
    : STATUS_ORDER;

  const grouped = statusCards.map((status) => {
    const items = allForTerm.filter((r) => r.status === status);
    return {
      status,
      label: maketaStatusLabel(status),
      count: items.length,
      preview: items.slice(0, 3),
    };
  });

  const rows = selectedStatus
    ? allForTerm.filter((r) => r.status === selectedStatus)
    : allForTerm.filter((r) => {
        const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
        if (r.status === "cancelled") return false;
        if (wt === "maketa" && r.status === "done") return false;
        if (wt === "grafika" && isGrafikaImlArchived(r.status, r.iml_applied_at)) return false;
        return true;
      });

  const tableRows: MaketyListRow[] = rows.map((r) => {
    const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
    const canEditRow =
      (wt === "grafika" ? canWriteGrafika : canWriteMaketa) &&
      r.created_by === userId &&
      r.status !== "done" &&
      r.status !== "cancelled";
    const canCopyRow = wt === "grafika" ? canWriteGrafika : canWriteMaketa;
    return {
      id: r.id,
      due_at: r.due_at.toISOString(),
      work_type: r.work_type,
      order_number: r.order_number,
      body: r.body,
      priority: r.priority,
      status: r.status,
      data_kind: r.data_kind,
      label_code: r.label_code,
      job_number: r.job_number,
      creator_name: r.users_creator
        ? `${r.users_creator.first_name} ${r.users_creator.last_name}`
        : null,
      assignee_name: r.users_assignee
        ? `${r.users_assignee.first_name} ${r.users_assignee.last_name}`
        : null,
      customer_name: r.iml_customers?.name ?? null,
      created_by: r.created_by,
      can_edit: canEditRow,
      can_copy: canCopyRow,
    };
  });

  const tableHeading = selectedStatus
    ? maketaStatusLabel(selectedStatus)
    : canModuleAdmin
      ? "Přehled aktivních zakázek"
      : "Aktivní zakázky";

  const headingExtraParts: string[] = [];
  if (selectedWorkType) {
    headingExtraParts.push(selectedWorkType === "grafika" ? "· Grafika" : "· Makety");
  }
  if (selectedTerm) {
    headingExtraParts.push(
      selectedTerm === "overdue"
        ? "· po termínu"
        : selectedTerm === "today"
          ? "· termín dnes"
          : "· termín do 7 dní"
    );
  }
  const headingExtra = headingExtraParts.length > 0 ? headingExtraParts.join(" ") : null;

  const showVyrobaHint = canModuleAdmin || (await hasMaketyVyrobaAccess(userId));
  const showGrafikaHint = canModuleAdmin || (await hasMaketyGrafikaAccess(userId));
  const showZadavatelCalendarHint =
    (await canZadatAnyMaketyWork(userId)) && !showVyrobaHint && !showGrafikaHint;

  return (
    <div className="space-y-5">
      {created && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          Maketa byla úspěšně vytvořena.
        </div>
      )}
      {grafikaCreated && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          Zakázka grafiky byla úspěšně vytvořena.
        </div>
      )}
      {commentSent && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          Komentář byl odeslán. Zakázka je zapsaná v přehledu.
        </div>
      )}
      {completed && (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 dark:border-green-800 dark:bg-green-950/40 dark:text-green-100">
          Maketa byla dokončena a přesunuta do archivu.
        </div>
      )}
      {showVyrobaHint && (
        <p className="text-sm text-gray-600">
          Fronta maket je seřazená podle termínu a priority (pořadí může upravit supervizor v{" "}
          <Link href="/makety/fronta" className="font-medium text-violet-600 hover:underline">
            Frontě výroby
          </Link>
          ).{" "}
          <Link href="/makety/kalendar" className="font-medium text-violet-600 hover:underline">
            Kalendář maket
          </Link>
          .
        </p>
      )}
      {showGrafikaHint && (
        <p className="text-sm text-gray-600">
          Fronta grafiky je seřazená podle termínu a priority (pořadí může upravit supervizor).{" "}
          <Link href="/makety/kalendar-grafika" className="font-medium text-violet-600 hover:underline">
            Kalendář grafiky
          </Link>
          .
        </p>
      )}
      {showZadavatelCalendarHint && (
        <p className="text-sm text-gray-600">
          Termíny svých zakázek podle přiřazení a dokončení:{" "}
          <Link href="/makety/kalendar" className="font-medium text-violet-600 hover:underline">
            Kalendář maket
          </Link>
          ,{" "}
          <Link href="/makety/kalendar-grafika" className="font-medium text-violet-600 hover:underline">
            Kalendář grafiky
          </Link>
          .
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildListQuery(selectedTerm, selectedStatus || undefined, undefined, {
            q: searchQ || undefined,
            priority: selectedPriority || undefined,
          })}
          className={workTypeToggleClass(!selectedWorkType)}
        >
          Vše
        </Link>
        <Link
          href={buildListQuery(selectedTerm, selectedStatus || undefined, "maketa", {
            q: searchQ || undefined,
            priority: selectedPriority || undefined,
          })}
          className={workTypeToggleClass(selectedWorkType === "maketa")}
        >
          Makety
        </Link>
        <Link
          href={buildListQuery(selectedTerm, selectedStatus || undefined, "grafika", {
            q: searchQ || undefined,
            priority: selectedPriority || undefined,
          })}
          className={workTypeToggleClass(selectedWorkType === "grafika")}
        >
          Grafika
        </Link>
      </div>

      <form
        method="get"
        action="/makety"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        {selectedStatus ? <input type="hidden" name="status" value={selectedStatus} /> : null}
        {selectedWorkType ? (
          <input type="hidden" name="work_type" value={selectedWorkType} />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[200px] flex-1">
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
          <div className="min-w-[160px]">
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Priorita</label>
            <select
              name="priority"
              defaultValue={selectedPriority}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            >
              <option value="">Vše</option>
              <option value="urgent">Urgentní</option>
              <option value="high">Vysoká</option>
              <option value="normal">Normální</option>
            </select>
          </div>
          <div className="min-w-[200px] flex-1">
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">Hledat</label>
            <input
              name="q"
              defaultValue={searchQ}
              placeholder="#id, kód, zakázka…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
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
        <p className="mt-2 text-xs text-gray-500">
          Počty ve stavech odpovídají zvolenému typu a termínu. Kliknutím na rámeček zobrazíte daný stav
          v tabulce níže.
        </p>
      </form>

      <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {grouped.map((g) => {
          const active = selectedStatus === g.status;
          return (
            <Link
              key={g.status}
              href={buildListQuery(selectedTerm, g.status, selectedWorkType || undefined, {
                q: searchQ || undefined,
                priority: selectedPriority || undefined,
              })}
              className={`block rounded-xl border bg-white p-4 shadow-sm transition-colors hover:border-violet-300 hover:bg-violet-50/30 ${
                active ? "border-violet-400 ring-2 ring-violet-200" : "border-gray-200"
              }`}
            >
              <div className="mb-2 flex items-center justify-between">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${maketaStatusBadgeClass(g.status)}`}
                >
                  {g.label}
                </span>
                <span className="text-sm font-semibold text-gray-700">{g.count}</span>
              </div>
              <div className="space-y-1">
                {g.preview.map((r) => (
                  <span key={r.id} className="block truncate text-sm text-gray-700">
                    #{r.id} {r.order_number ? `· ${r.order_number}` : ""}{" "}
                    {r.body.replace(/\s+/g, " ").trim().slice(0, 28)}
                  </span>
                ))}
                {g.count === 0 && <p className="text-xs text-gray-400">Žádné záznamy</p>}
              </div>
            </Link>
          );
        })}
      </section>

      <MaketyActiveTableClient
        heading={tableHeading}
        headingExtra={headingExtra}
        rows={tableRows}
        canModuleAdmin={canModuleAdmin}
      />
    </div>
  );
}
