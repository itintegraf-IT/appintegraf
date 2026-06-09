import { prisma } from "@/lib/db";
import { getMonthRange, getQuarterRange } from "@/lib/crm/date-ranges";
import type { Prisma } from "@prisma/client";

type Props = { owner_id?: number };
type ForecastRow = { count: number; sum: number; weighted: number };

async function forecast(where: Prisma.crm_dealsWhereInput): Promise<ForecastRow> {
  const deals = await prisma.crm_deals.findMany({
    where,
    select: { value: true, probability: true },
  });
  let sum = 0;
  let weighted = 0;
  for (const d of deals) {
    const v = Number(d.value);
    sum += v;
    weighted += v * (d.probability / 100);
  }
  return { count: deals.length, sum, weighted };
}

function dealCountLabel(n: number): string {
  if (n === 1) return "deal";
  if (n >= 2 && n <= 4) return "dealy";
  return "dealů";
}

export async function ForecastWidget({ owner_id }: Props) {
  const now = new Date();
  const month = getMonthRange(now);
  const quarter = getQuarterRange(now);

  const baseWhere: Prisma.crm_dealsWhereInput = {
    ...(owner_id ? { owner_id } : {}),
    stage: { notIn: ["WON", "LOST", "CANCELLED"] },
  };

  const [m, q] = await Promise.all([
    forecast({ ...baseWhere, close_date: { gte: month.start, lt: month.end } }),
    forecast({ ...baseWhere, close_date: { gte: quarter.start, lt: quarter.end } }),
  ]);

  const fmt = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  });

  const monthLabel = now.toLocaleString("cs-CZ", { month: "long", year: "numeric" });
  const quarterNum = Math.floor(now.getUTCMonth() / 3) + 1;
  const quarterLabel = `Q${quarterNum} ${now.getUTCFullYear()}`;

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-gray-900">Forecast</h3>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <ForecastCell title={monthLabel} row={m} fmt={fmt} />
        <ForecastCell title={quarterLabel} row={q} fmt={fmt} />
      </div>
    </div>
  );
}

function ForecastCell({
  title,
  row,
  fmt,
}: {
  title: string;
  row: ForecastRow;
  fmt: Intl.NumberFormat;
}) {
  return (
    <div className="rounded-md border border-gray-200 bg-gray-50 p-3">
      <p className="text-xs uppercase tracking-wider text-gray-500">{title}</p>
      <p className="mt-2 text-2xl font-semibold">{fmt.format(row.weighted)}</p>
      <p className="mt-1 text-xs text-gray-500">
        {row.count} {dealCountLabel(row.count)} · total {fmt.format(row.sum)}
      </p>
    </div>
  );
}
