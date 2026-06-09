import { requireCrmRead, requireCrmWrite } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { DealCreateSchema, DealListQuerySchema } from "@/lib/crm/validators/deal";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { generateDealNumber } from "@/lib/crm/deal-number";

export const GET = withApiError(async (req: NextRequest) => {
  await requireCrmRead();
  const parsed = DealListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatné parametry");
  const { q, stage, owner_id, company_id, take, skip } = parsed.data;

  const where = {
    ...(stage ? { stage } : {}),
    ...(owner_id ? { owner_id } : {}),
    ...(company_id ? { company_id } : {}),
    ...(q
      ? {
          OR: [{ title: { contains: q } }, { company: { name: { contains: q } } }],
        }
      : {}),
  };

  const [items, total] = await Promise.all([
    prisma.crm_deals.findMany({
      where,
      include: {
        company: { select: { id: true, name: true } },
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      },
      orderBy: { updated_at: "desc" },
      take,
      skip,
    }),
    prisma.crm_deals.count({ where }),
  ]);
  return NextResponse.json({ items, total });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireCrmWrite();
  const body: unknown = await req.json();
  const parsed = DealCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const d = parsed.data;

  let attempts = 0;
  let created: Awaited<ReturnType<typeof prisma.crm_deals.create>> | undefined;
  while (attempts < 3) {
    try {
      const number = await prisma.$transaction(async (tx) => generateDealNumber(tx));
      created = await prisma.crm_deals.create({
        data: {
          number,
          company_id: d.company_id,
          owner_id: d.owner_id ?? user.id,
          title: d.title,
          value: d.value,
          stage: d.stage,
          probability: d.probability,
          close_date: d.close_date ? new Date(d.close_date) : null,
          lost_reason: d.stage === "LOST" ? d.lost_reason || null : null,
          category_id: d.category_id ?? null,
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

  if (!created) throw new AppError("CONFLICT", "Nepodařilo se vygenerovat číslo dealu.");
  const dealId = created.id;

  if (d.contactIds?.length) {
    await Promise.all(
      d.contactIds.map((contactId) =>
        prisma.crm_deal_contacts.create({ data: { deal_id: dealId, contact_id: contactId } }),
      ),
    );
  }
  return NextResponse.json(created, { status: 201 });
});
