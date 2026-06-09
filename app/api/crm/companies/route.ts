import { requireCrmRead, requireCrmWrite } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { CompanyCreateSchema, CompanyListQuerySchema } from "@/lib/crm/validators/company";
import { AppError } from "@/lib/crm/errors";

export const GET = withApiError(async (req: NextRequest) => {
  await requireCrmRead();
  const parsed = CompanyListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatné parametry");
  const { q, owner_id, segment, take, skip } = parsed.data;

  const where = {
    ...(q ? { OR: [{ name: { contains: q } }, { ico: { contains: q } }] } : {}),
    ...(owner_id ? { owner_id } : {}),
    ...(segment ? { segment } : {}),
  };
  const [items, total] = await Promise.all([
    prisma.crm_companies.findMany({
      where,
      include: {
        owner: { select: { id: true, first_name: true, last_name: true, email: true } },
        _count: { select: { contacts: true, deals: true } },
      },
      orderBy: { updated_at: "desc" },
      take,
      skip,
    }),
    prisma.crm_companies.count({ where }),
  ]);
  return NextResponse.json({ items, total });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireCrmWrite();
  const body: unknown = await req.json();
  const parsed = CompanyCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const data = parsed.data;
  const created = await prisma.crm_companies.create({
    data: {
      name: data.name,
      ico: data.ico || null,
      dic: data.dic || null,
      address: data.address || null,
      segment: data.segment || null,
      tags: data.tags ?? undefined,
      owner_id: data.owner_id ?? user.id,
    },
  });
  return NextResponse.json(created, { status: 201 });
});
