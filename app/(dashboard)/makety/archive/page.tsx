import Link from "next/link";
import type { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  applyWorkTypeToWhere,
  buildMaketyListWhere,
  canViewAllMaketyTypes,
  canZadatMaketyWork,
} from "@/lib/makety-access";
import { maketyArchiveWhereClause } from "@/lib/makety-status";
import { isMaketyWorkType, type MaketyWorkType } from "@/lib/makety-work-type";
import type { MaketyListRow } from "@/lib/makety/makety-list-columns";
import { MAKETY_ARCHIVE_LIST_COLUMNS_STORAGE_KEY } from "@/lib/makety/makety-list-columns";
import { MaketyActiveTableClient } from "../_components/MaketyActiveTableClient";

export const dynamic = "force-dynamic";

function buildArchiveQuery(workType?: string, q?: string): string {
  const p = new URLSearchParams();
  if (workType) p.set("work_type", workType);
  if (q) p.set("q", q);
  const s = p.toString();
  return s ? `/makety/archive?${s}` : "/makety/archive";
}

function workTypeToggleClass(active: boolean): string {
  return `rounded-lg border px-4 py-2 text-sm font-medium ${
    active
      ? "border-violet-200 bg-violet-50 text-violet-700"
      : "border-gray-200 bg-white text-gray-700 hover:bg-gray-50"
  }`;
}

export default async function MaketyArchivePage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; work_type?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const canWriteMaketa = await canZadatMaketyWork(userId, "maketa");
  const canWriteGrafika = await canZadatMaketyWork(userId, "grafika");
  const canModuleAdmin = await canViewAllMaketyTypes(userId);

  const params = await searchParams;
  const searchQ = (params.q ?? "").trim();
  const rawWorkType = params.work_type ?? "";
  const selectedWorkType: MaketyWorkType | "" = isMaketyWorkType(rawWorkType) ? rawWorkType : "";

  const where = await buildMaketyListWhere(userId, maketyArchiveWhereClause());
  if (selectedWorkType) applyWorkTypeToWhere(where, [selectedWorkType]);

  if (searchQ) {
    const idRaw = searchQ.replace(/^#/, "").trim();
    const idNum = parseInt(idRaw, 10);
    const or: Prisma.maketyWhereInput[] = [
      { label_code: { contains: searchQ } },
      { job_number: { contains: searchQ } },
      { order_number: { contains: searchQ } },
      { body: { contains: searchQ } },
      { iml_customers: { name: { contains: searchQ } } },
    ];
    if (!Number.isNaN(idNum) && String(idNum) === idRaw) {
      or.push({ id: idNum });
    }
    const existingAnd = Array.isArray(where.AND)
      ? where.AND
      : where.AND
        ? [where.AND]
        : [];
    where.AND = [...existingAnd, { OR: or }];
  }

  const rowsRaw = await prisma.makety.findMany({
    where,
    orderBy: { updated_at: "desc" },
    take: 500,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
      iml_customers: { select: { id: true, name: true } },
    },
  });

  const tableRows: MaketyListRow[] = rowsRaw.map((r) => {
    const wt = (r.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
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
      customer_id: r.customer_id,
      customer_name: r.iml_customers?.name ?? null,
      created_by: r.created_by,
      can_edit: false,
      can_copy: canCopyRow,
      needs_attention: false,
    };
  });

  const headingExtraParts: string[] = [];
  if (selectedWorkType) {
    headingExtraParts.push(selectedWorkType === "grafika" ? "· Grafika" : "· Makety");
  }
  if (searchQ) headingExtraParts.push(`· „${searchQ}“`);
  const headingExtra = headingExtraParts.length > 0 ? headingExtraParts.join(" ") : null;

  return (
    <div className="space-y-4">
      <p className="text-sm text-gray-600">
        Hotové a zrušené zakázky (makety i grafika). Metadata zůstávají; přílohy se při archivaci
        nemažou.
      </p>

      <div className="flex flex-wrap gap-2">
        <Link
          href={buildArchiveQuery(undefined, searchQ || undefined)}
          className={workTypeToggleClass(!selectedWorkType)}
        >
          Vše
        </Link>
        <Link
          href={buildArchiveQuery("maketa", searchQ || undefined)}
          className={workTypeToggleClass(selectedWorkType === "maketa")}
        >
          Makety
        </Link>
        <Link
          href={buildArchiveQuery("grafika", searchQ || undefined)}
          className={workTypeToggleClass(selectedWorkType === "grafika")}
        >
          Grafika
        </Link>
      </div>

      <form
        method="get"
        action="/makety/archive"
        className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
      >
        {selectedWorkType ? (
          <input type="hidden" name="work_type" value={selectedWorkType} />
        ) : null}
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-[220px] flex-1">
            <label className="mb-1 block text-xs font-medium uppercase text-gray-500">
              Hledat
            </label>
            <input
              type="search"
              name="q"
              defaultValue={searchQ}
              placeholder="Kód, zakázka, klient, popis, #id…"
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </div>
          <button
            type="submit"
            className="rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-700"
          >
            Hledat
          </button>
          {searchQ ? (
            <Link
              href={buildArchiveQuery(selectedWorkType || undefined)}
              className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
            >
              Zrušit filtr
            </Link>
          ) : null}
        </div>
      </form>

      <MaketyActiveTableClient
        heading="Archiv zakázek"
        headingExtra={headingExtra}
        rows={tableRows}
        canModuleAdmin={canModuleAdmin}
        columnsStorageKey={MAKETY_ARCHIVE_LIST_COLUMNS_STORAGE_KEY}
      />
    </div>
  );
}
