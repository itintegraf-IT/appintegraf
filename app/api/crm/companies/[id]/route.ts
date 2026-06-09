import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { CompanyUpdateSchema } from "@/lib/crm/validators/company";
import { AppError } from "@/lib/crm/errors";
import { canEditCompany } from "@/lib/crm/rbac";

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  await requireCrmRead();
  const { id } = await params;
  const company = await prisma.crm_companies.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      contacts: { orderBy: { last_name: "asc" } },
      deals: {
        orderBy: { updated_at: "desc" },
        include: { owner: { select: { first_name: true, last_name: true, email: true } } },
      },
    },
  });
  if (!company) throw new AppError("NOT_FOUND", "Firma nebyla nalezena.");
  return NextResponse.json(company);
});

export const PATCH = withApiError(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const existing = await prisma.crm_companies.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Firma nebyla nalezena.");
  if (!canEditCompany(user, existing)) throw new AppError("FORBIDDEN", "Nemůžeš editovat tuto firmu.");

  const body: unknown = await req.json();
  const parsed = CompanyUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  if (parsed.data.owner_id !== undefined && user.role !== "ADMIN") {
    throw new AppError("FORBIDDEN", "Změnit vlastníka může jen administrátor.");
  }

  const updated = await prisma.crm_companies.update({
    where: { id },
    data: {
      ...(parsed.data.name !== undefined && { name: parsed.data.name }),
      ...(parsed.data.ico !== undefined && { ico: parsed.data.ico || null }),
      ...(parsed.data.dic !== undefined && { dic: parsed.data.dic || null }),
      ...(parsed.data.address !== undefined && { address: parsed.data.address || null }),
      ...(parsed.data.segment !== undefined && { segment: parsed.data.segment || null }),
      ...(parsed.data.tags !== undefined && { tags: parsed.data.tags }),
      ...(parsed.data.owner_id !== undefined && { owner_id: parsed.data.owner_id }),
    },
  });
  return NextResponse.json(updated);
});

export const DELETE = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const existing = await prisma.crm_companies.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Firma nebyla nalezena.");
  if (!canEditCompany(user, existing)) throw new AppError("FORBIDDEN", "Nemůžeš smazat tuto firmu.");

  await prisma.crm_companies.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
