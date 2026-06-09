import { requireCrmRead, requireCrmWrite, requireCrmAdmin } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { ContactUpdateSchema } from "@/lib/crm/validators/contact";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { canEditCompany } from "@/lib/crm/rbac";

type Ctx = { params: Promise<{ id: string }> };

async function loadWithCompany(id: string) {
  const contact = await prisma.crm_contacts.findUnique({
    where: { id },
    include: { company: true },
  });
  if (!contact) throw new AppError("NOT_FOUND", "Kontakt nenalezen.");
  return contact;
}

export const GET = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  await requireCrmRead();
  const { id } = await params;
  const contact = await loadWithCompany(id);
  return NextResponse.json(contact);
});

export const PATCH = withApiError(async (req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const contact = await loadWithCompany(id);
  if (!canEditCompany(user, contact.company)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat kontakty této firmy.");
  }
  const body: unknown = await req.json();
  const parsed = ContactUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Neplatná data");

  const p = prisma;
  const d = parsed.data;
  const updated = await p.crm_contacts.update({
    where: { id },
    data: {
      ...(d.first_name !== undefined && { first_name: d.first_name }),
      ...(d.last_name !== undefined && { last_name: d.last_name }),
      ...(d.role !== undefined && { role: d.role || null }),
      ...(d.email !== undefined && { email: d.email || null }),
      ...(d.phone !== undefined && { phone: d.phone || null }),
      ...(d.is_decision_maker !== undefined && { is_decision_maker: d.is_decision_maker }),
      ...(d.company_id !== undefined && { company_id: d.company_id }),
    },
  });
  return NextResponse.json(updated);
});

export const DELETE = withApiError(async (_req: NextRequest, { params }: Ctx) => {
  const user = await requireCrmRead();
  const { id } = await params;
  const contact = await loadWithCompany(id);
  if (!canEditCompany(user, contact.company)) {
    throw new AppError("FORBIDDEN", "Nemůžeš smazat tento kontakt.");
  }
  const p = prisma;
  await p.crm_contacts.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
