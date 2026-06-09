import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { writeCrmAuditLog } from "@/lib/crm/audit";

type Params = { params: Promise<{ id: string }> };

const PatchSchema = z.object({
  label: z.string().trim().min(1).max(200).optional(),
  active: z.boolean().optional(),
});

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const admin = await requireCrmAdmin();
  const { id } = await params;
  const body: unknown = await req.json();
  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues.map((i) => i.message).join(" "));
  }

  const existing = await prisma.crm_lost_reasons.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Důvod nenalezen.");

  const updated = await prisma.crm_lost_reasons.update({
    where: { id },
    data: parsed.data,
  });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "LostReason",
    entity_id: id,
    action: "UPDATE",
    diff: parsed.data as Record<string, unknown>,
  });

  return NextResponse.json({ reason: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const admin = await requireCrmAdmin();
  const { id } = await params;
  const existing = await prisma.crm_lost_reasons.findUnique({ where: { id } });
  if (!existing) throw new AppError("NOT_FOUND", "Důvod nenalezen.");

  await prisma.crm_lost_reasons.delete({ where: { id } });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "LostReason",
    entity_id: id,
    action: "DELETE",
    diff: { code: existing.code },
  });

  return new NextResponse(null, { status: 204 });
});
