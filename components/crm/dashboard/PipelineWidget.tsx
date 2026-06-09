import { prisma } from "@/lib/db";
import type { crm_deal_stage } from "@prisma/client";
import { STAGE_LABELS, ACTIVE_STAGES, STAGE_DOT } from "@/lib/crm/deal-stages";

export async function PipelineWidget({ owner_id }: { owner_id?: number }) {
  const deals = await prisma.crm_deals.findMany({
    where: {
      ...(owner_id ? { owner_id } : {}),
      stage: { notIn: ["WON", "LOST", "CANCELLED"] },
    },
    select: { stage: true, value: true, probability: true },
  });

  const byStage = new Map<crm_deal_stage, { count: number; sum: number; weighted: number }>();
  for (const s of ACTIVE_STAGES) byStage.set(s, { count: 0, sum: 0, weighted: 0 });

  for (const d of deals) {
    const agg = byStage.get(d.stage)!;
    const v = Number(d.value);
    agg.count += 1;
    agg.sum += v;
    agg.weighted += v * (d.probability / 100);
  }

  const totalSum = deals.reduce((acc, d) => acc + Number(d.value), 0);
  const totalWeighted = deals.reduce(
    (acc, d) => acc + Number(d.value) * (d.probability / 100),
    0
  );
  const fmt = new Intl.NumberFormat("cs-CZ", {
    style: "currency",
    currency: "CZK",
    maximumFractionDigits: 0,
  });

  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
      <h3 className="mb-4 text-[13px] font-semibold tracking-tight text-gray-900">Pipeline</h3>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        {ACTIVE_STAGES.map((s) => {
          const agg = byStage.get(s)!;
          return (
            <div key={s} className="rounded-md border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center gap-2">
                <span className={`size-2 rounded-full ${STAGE_DOT[s]}`} aria-hidden />
                <p className="text-xs text-gray-600">{STAGE_LABELS[s]}</p>
              </div>
              <p className="mt-1 text-lg font-semibold">{agg.count}</p>
              <p className="text-xs text-gray-500">{fmt.format(agg.sum)}</p>
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex justify-between border-t border-gray-200 pt-3 text-sm">
        <span>
          Celkem: <strong>{fmt.format(totalSum)}</strong>
        </span>
        <span>
          Vážený: <strong>{fmt.format(totalWeighted)}</strong>
        </span>
      </div>
    </div>
  );
}
