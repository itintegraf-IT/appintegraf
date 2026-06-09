import { NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { DealCategoryUpdateSchema } from "@/lib/crm/validators/deal-category";
import { writeCrmAuditLog } from "@/lib/crm/audit";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const admin = await requireCrmAdmin();
  const { id } = await params;
  const body: unknown = await req.json();
  const parsed = DealCategoryUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues.map((i) => i.message).join(" "));
  }

  const existing = await prisma.crm_deal_categories.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Kategorie nenalezena.");

  const { sortOrder, ...rest } = parsed.data;
  const updated = await prisma.crm_deal_categories.update({
    where: { id },
    data: {
      ...rest,
      ...(sortOrder !== undefined ? { sort_order: sortOrder } : {}),
    },
  });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "DealCategory",
    entity_id: id,
    action: "UPDATE",
    diff: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ category: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const admin = await requireCrmAdmin();
  const { id } = await params;
  const existing = await prisma.crm_deal_categories.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Kategorie nenalezena.");

  await prisma.crm_deal_categories.delete({ where: { id } });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "DealCategory",
    entity_id: id,
    action: "DELETE",
    diff: { code: existing.code },
  });

  return new NextResponse(null, { status: 204 });
});
