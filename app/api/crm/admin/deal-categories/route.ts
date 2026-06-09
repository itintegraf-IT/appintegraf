import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { DealCategoryCreateSchema } from "@/lib/crm/validators/deal-category";
import { writeCrmAuditLog } from "@/lib/crm/audit";

export const GET = withApiError(async () => {
  await requireCrmAdmin();
  const categories = await prisma.crm_deal_categories.findMany({
    orderBy: [{ active: "desc" }, { sort_order: "asc" }, { label: "asc" }],
  });
  return NextResponse.json({ categories });
});

export const POST = withApiError(async (req: Request) => {
  const admin = await requireCrmAdmin();
  const body: unknown = await req.json();
  const parsed = DealCategoryCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues.map((i) => i.message).join(" "));
  }

  const existing = await prisma.crm_deal_categories.findUnique({ where: { code: parsed.data.code } });
  if (existing) throw new AppError("VALIDATION", "Kód už existuje.");

  const category = await prisma.crm_deal_categories.create({
    data: {
      code: parsed.data.code,
      label: parsed.data.label,
      color: parsed.data.color,
      sort_order: parsed.data.sortOrder,
      active: parsed.data.active,
    },
  });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "DealCategory",
    entity_id: category.id,
    action: "CREATE",
    diff: { code: category.code, label: category.label },
  });

  return NextResponse.json({ category }, { status: 201 });
});
