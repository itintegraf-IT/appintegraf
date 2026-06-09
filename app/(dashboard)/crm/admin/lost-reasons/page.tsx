import { prisma } from "@/lib/db";
import { LostReasonsEditor } from "./LostReasonsEditor";

export const dynamic = "force-dynamic";

export default async function LostReasonsPage() {
  const reasons = await prisma.crm_lost_reasons.findMany({
    orderBy: [{ active: "desc" }, { label: "asc" }],
  });
  return (
    <div className="flex flex-col gap-4">
      <h2 className="text-xl font-semibold text-gray-900">Důvody prohry dealu</h2>
      <LostReasonsEditor initialReasons={reasons} />
    </div>
  );
}
