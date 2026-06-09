import { requireCrmWrite } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { generateDealNumber } from "@/lib/crm/deal-number";

type Ctx = { params: Promise<{ id: string }> };

export const POST = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmWrite();
  const { id } = await params;

  const source = await prisma.crm_deals.findUnique({
    where: { id },
    include: { deal_contacts: true },
  });
  if (!source) throw new AppError("NOT_FOUND", "Deal nenalezen.");

  let attempts = 0;
  let created: Awaited<ReturnType<typeof prisma.crm_deals.create>> | undefined;
  while (attempts < 3) {
    try {
      const number = await prisma.$transaction(async (tx) => generateDealNumber(tx));
      created = await prisma.crm_deals.create({
        data: {
          number,
          company_id: source.company_id,
          owner_id: user.id,
          title: `${source.title} (kopie)`,
          value: source.value,
          stage: "LEAD",
          probability: 10,
          close_date: null,
          category_id: source.category_id,
        },
      });
      break;
    } catch (err: unknown) {
      const code = (err as { code?: string }).code;
      if (code === "P2002" && attempts < 2) {
        attempts++;
        continue;
      }
      throw err;
    }
  }

  if (!created) throw new AppError("CONFLICT", "Nepodařilo se duplikovat deal.");

  const newDealId = created.id;
  if (source.deal_contacts.length) {
    await Promise.all(
      source.deal_contacts.map((dc) =>
        prisma.crm_deal_contacts.create({
          data: { deal_id: newDealId, contact_id: dc.contact_id },
        }),
      ),
    );
  }

  return NextResponse.json(created, { status: 201 });
});
