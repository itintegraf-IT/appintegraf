import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { DealStageUpdateSchema } from "@/lib/crm/validators/deal";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { canEditDeal } from "@/lib/crm/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const existing = await prisma.crm_deals.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Deal nenalezen.");
  if (!canEditDeal(user, existing)) throw new AppError("FORBIDDEN", "Nemůžeš měnit stage tohoto dealu.");

  const body: unknown = await req.json();
  const parsed = DealStageUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const updated = await prisma.crm_deals.update({
    where: { id },
    data: {
      stage: parsed.data.stage,
      lost_reason: parsed.data.stage === "LOST" ? parsed.data.lost_reason ?? null : null,
    },
  });
  return NextResponse.json(updated);
});
