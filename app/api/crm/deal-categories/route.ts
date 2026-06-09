import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";

import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";

export const GET = withApiError(async (req: NextRequest) => {
  await requireCrmRead();
  const onlyActive = req.nextUrl.searchParams.get("active") === "true";
  const categories = await prisma.crm_deal_categories.findMany({
    where: onlyActive ? { active: true } : undefined,
    orderBy: [{ sort_order: "asc" }, { label: "asc" }],
    select: { id: true, code: true, label: true, color: true, active: true, sort_order: true },
  });
  return NextResponse.json({ categories });
});
