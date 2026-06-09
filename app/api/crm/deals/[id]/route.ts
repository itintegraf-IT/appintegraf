import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { DealUpdateSchema } from "@/lib/crm/validators/deal";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { canEditDeal } from "@/lib/crm/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  await requireCrmRead();
  const { id } = await params;
  const deal = await prisma.crm_deals.findUnique({
    where: { id },
    include: {
      company: true,
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      deal_contacts: { include: { contact: true } },
    },
  });
  if (!deal) throw new AppError("NOT_FOUND", "Deal nenalezen.");
  return NextResponse.json(deal);
});

export const PATCH = withApiError(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const existing = await prisma.crm_deals.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Deal nenalezen.");
  if (!canEditDeal(user, existing)) throw new AppError("FORBIDDEN", "Nemůžeš editovat tento deal.");

  const body: unknown = await req.json();
  const parsed = DealUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const d = parsed.data;
  if (d.owner_id !== undefined && user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Změnit vlastníka může jen administrátor.");
  }

  const updated = await prisma.$transaction(async (tx) => {
    const updatedDeal = await tx.crm_deals.update({
      where: { id },
      data: {
        ...(d.title !== undefined && { title: d.title }),
        ...(d.value !== undefined && { value: d.value }),
        ...(d.stage !== undefined && { stage: d.stage }),
        ...(d.probability !== undefined && { probability: d.probability }),
        ...(d.close_date !== undefined && { close_date: d.close_date ? new Date(d.close_date) : null }),
        ...(d.owner_id !== undefined && { owner_id: d.owner_id }),
        ...(d.company_id !== undefined && { company_id: d.company_id }),
        ...(d.lost_reason !== undefined && { lost_reason: d.lost_reason || null }),
        ...(d.category_id !== undefined ? { category_id: d.category_id } : {}),
      },
    });

    if (d.contactIds !== undefined) {
      await tx.crm_deal_contacts.deleteMany({ where: { deal_id: id } });
      for (const cid of d.contactIds) {
        await tx.crm_deal_contacts.create({ data: { deal_id: id, contact_id: cid } });
      }
    }

    return updatedDeal;
  });

  return NextResponse.json(updated);
});

export const DELETE = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const existing = await prisma.crm_deals.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Deal nenalezen.");
  if (!canEditDeal(user, existing)) throw new AppError("FORBIDDEN", "Nemůžeš smazat tento deal.");
  await prisma.crm_deals.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
