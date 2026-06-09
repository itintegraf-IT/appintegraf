import { requireCrmRead, requireCrmWrite } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { ContactCreateSchema, ContactListQuerySchema } from "@/lib/crm/validators/contact";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";

export const GET = withApiError(async (req: NextRequest) => {
  await requireCrmRead();
  const parsed = ContactListQuerySchema.safeParse(Object.fromEntries(req.nextUrl.searchParams));
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatné parametry");
  const { q, company_id, take, skip } = parsed.data;

  const where = {
    ...(company_id ? { company_id } : {}),
    ...(q
      ? {
          OR: [
            { first_name: { contains: q } },
            { last_name: { contains: q } },
            { email: { contains: q } },
          ],
        }
      : {}),
  };
  const [items, total] = await Promise.all([
    prisma.crm_contacts.findMany({
      where,
      include: { company: { select: { id: true, name: true } } },
      orderBy: [{ last_name: "asc" }, { first_name: "asc" }],
      take,
      skip,
    }),
    prisma.crm_contacts.count({ where }),
  ]);
  return NextResponse.json({ items, total });
});

export const POST = withApiError(async (req: NextRequest) => {
  await requireCrmWrite();
  const body: unknown = await req.json();
  const parsed = ContactCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const company = await prisma.crm_companies.findUnique({ where: { id: parsed.data.company_id } });
  if (!company) throw new AppError("NOT_FOUND", "Firma nenalezena.");

  const d = parsed.data;
  const created = await prisma.crm_contacts.create({
    data: {
      company_id: d.company_id,
      first_name: d.first_name,
      last_name: d.last_name,
      role: d.role || null,
      email: d.email || null,
      phone: d.phone || null,
      is_decision_maker: d.is_decision_maker ?? false,
    },
  });
  return NextResponse.json(created, { status: 201 });
});
