import Link from "next/link";
import { prisma } from "@/lib/db";
import {
  STITKY_ORDER_STATUSES,
  type StitkyOrderStatus,
} from "@/lib/stitky/constants";
import {
  buildStitkyListWhere,
  type StitkyListView,
} from "@/lib/stitky/list-access";
import { stitkyStatusBadgeClass, stitkyStatusLabel } from "@/lib/stitky/status-badges";

type CardDef = {
  key: string;
  label: string;
  status?: StitkyOrderStatus | "waiting" | "active";
  count: number;
};

function buildListHref(basePath: string, status?: string): string {
  if (!status) return basePath;
  return `${basePath}?status=${status}`;
}

export async function StitkyStatusCards({
  userId,
  view,
  basePath,
  selectedStatus,
}: {
  userId: number;
  view: StitkyListView;
  basePath: string;
  selectedStatus: StitkyOrderStatus | "";
}) {
  const baseWhere = buildStitkyListWhere(userId, view);

  const counts = await prisma.stitky_orders.groupBy({
    by: ["status"],
    where: baseWhere,
    _count: { _all: true },
  });

  const countMap = new Map(counts.map((c) => [c.status, c._count._all]));

  let cards: CardDef[];

  if (view === "queue") {
    cards = [
      {
        key: "SUBMITTED",
        label: "Pro mailing",
        status: "SUBMITTED",
        count: countMap.get("SUBMITTED") ?? 0,
      },
      {
        key: "SUBMITTED_MISTRI",
        label: "Pro mistry",
        status: "SUBMITTED_MISTRI",
        count: countMap.get("SUBMITTED_MISTRI") ?? 0,
      },
      {
        key: "PRINTED",
        label: "Vytištěno",
        status: "PRINTED",
        count: countMap.get("PRINTED") ?? 0,
      },
      {
        key: "active",
        label: "Celkem ve frontě",
        status: "active",
        count:
          (countMap.get("SUBMITTED") ?? 0) +
          (countMap.get("SUBMITTED_MISTRI") ?? 0) +
          (countMap.get("PRINTED") ?? 0),
      },
    ];
  } else {
    const waiting =
      (countMap.get("SUBMITTED") ?? 0) + (countMap.get("SUBMITTED_MISTRI") ?? 0);
    cards = [
      {
        key: "DRAFT",
        label: "Rozpracované",
        status: "DRAFT",
        count: countMap.get("DRAFT") ?? 0,
      },
      {
        key: "waiting",
        label: "Čeká na tisk",
        status: "waiting",
        count: waiting,
      },
      {
        key: "PRINTED",
        label: "Vytištěno",
        status: "PRINTED",
        count: countMap.get("PRINTED") ?? 0,
      },
      {
        key: "DONE",
        label: "Hotovo",
        status: "DONE",
        count: countMap.get("DONE") ?? 0,
      },
    ];
  }

  return (
    <div className="mb-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {cards.map((card) => {
        const filterStatus =
          card.status === "waiting"
            ? "SUBMITTED"
            : card.status === "active"
              ? ""
              : card.status;
        const isActive =
          card.status === "waiting"
            ? selectedStatus === "SUBMITTED" || selectedStatus === "SUBMITTED_MISTRI"
            : card.status === "active"
              ? !selectedStatus
              : selectedStatus === card.status;

        const href =
          card.status === "waiting"
            ? buildListHref(basePath, "SUBMITTED")
            : card.status === "active"
              ? basePath
              : buildListHref(basePath, filterStatus);

        return (
          <Link
            key={card.key}
            href={href}
            className={`rounded-xl border p-4 transition-colors ${
              isActive
                ? "border-red-200 bg-red-50"
                : "border-gray-200 bg-white hover:border-red-100 hover:bg-red-50/30"
            }`}
          >
            <p className="text-2xl font-bold text-gray-900">{card.count}</p>
            <p className="text-sm text-gray-600">{card.label}</p>
          </Link>
        );
      })}
    </div>
  );
}

type OrderRow = {
  id: number;
  order_number: string;
  template_key: string;
  status: string;
  updated_at: Date;
  users_creator: { first_name: string; last_name: string };
};

export async function StitkyOrdersTable({
  userId,
  view,
  basePath,
  selectedStatus,
  showCreator = false,
}: {
  userId: number;
  view: StitkyListView;
  basePath: string;
  selectedStatus: StitkyOrderStatus | "";
  showCreator?: boolean;
}) {
  const where = buildStitkyListWhere(userId, view, selectedStatus);

  if (
    selectedStatus === "SUBMITTED" &&
    (view === "mine" || view === "all")
  ) {
    where.status = { in: ["SUBMITTED", "SUBMITTED_MISTRI"] };
  }

  const orders = await prisma.stitky_orders.findMany({
    where,
    orderBy: [{ updated_at: "desc" }],
    take: 200,
    include: {
      template: { select: { key: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  const sorted = [...orders].sort((a, b) => {
    const aDone = a.status === "DONE" ? 1 : 0;
    const bDone = b.status === "DONE" ? 1 : 0;
    if (aDone !== bDone) return aDone - bDone;
    return b.updated_at.getTime() - a.updated_at.getTime();
  });

  const colSpan = showCreator ? 6 : 5;

  return (
    <>
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-gray-600">
          {sorted.length} zakázek
          {selectedStatus ? ` · ${stitkyStatusLabel(selectedStatus)}` : ""}
        </p>
        {selectedStatus && (
          <Link href={basePath} className="text-sm text-red-700 hover:underline">
            Zrušit filtr
          </Link>
        )}
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-left text-xs uppercase text-gray-500">
            <tr>
              <th className="px-4 py-3">Číslo</th>
              <th className="px-4 py-3">Šablona</th>
              <th className="px-4 py-3">Stav</th>
              {showCreator && <th className="px-4 py-3">Zadavatel</th>}
              <th className="px-4 py-3">Čeká od / aktualizováno</th>
            </tr>
          </thead>
          <tbody>
            {sorted.length === 0 ? (
              <tr>
                <td colSpan={colSpan} className="px-4 py-8 text-center text-gray-500">
                  Žádné zakázky
                </td>
              </tr>
            ) : (
              sorted.map((o: OrderRow) => (
                <tr key={o.id} className="border-t border-gray-100 hover:bg-gray-50">
                  <td className="px-4 py-3">
                    <Link
                      href={`/stitky/${o.id}`}
                      className="font-medium text-red-700 hover:underline"
                    >
                      {o.order_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.template_key}</td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${stitkyStatusBadgeClass(o.status)}`}
                    >
                      {stitkyStatusLabel(o.status)}
                    </span>
                  </td>
                  {showCreator && (
                    <td className="px-4 py-3">
                      {o.users_creator.first_name} {o.users_creator.last_name}
                    </td>
                  )}
                  <td className="px-4 py-3 text-gray-500">
                    {o.updated_at.toLocaleString("cs-CZ")}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </>
  );
}

export function parseStitkyStatusParam(
  status: string | undefined
): StitkyOrderStatus | "" {
  if (status && STITKY_ORDER_STATUSES.includes(status as StitkyOrderStatus)) {
    return status as StitkyOrderStatus;
  }
  return "";
}
