import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiError } from "@/lib/crm/api-utils";
import { requireCrmAdmin } from "@/lib/crm/guards";
import { AppError } from "@/lib/crm/errors";
import { prisma } from "@/lib/db";
import { writeCrmAuditLog } from "@/lib/crm/audit";

const CreateSchema = z.object({
  code: z.string().trim().min(1).max(50),
  label: z.string().trim().min(1).max(200),
  active: z.boolean().optional().default(true),
});

export const GET = withApiError(async () => {
  await requireCrmAdmin();
  const reasons = await prisma.crm_lost_reasons.findMany({
    orderBy: [{ active: "desc" }, { label: "asc" }],
  });
  return NextResponse.json({ reasons });
});

export const POST = withApiError(async (req: Request) => {
  const admin = await requireCrmAdmin();
  const body: unknown = await req.json();
  const parsed = CreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues.map((i) => i.message).join(" "));
  }

  const existing = await prisma.crm_lost_reasons.findUnique({ where: { code: parsed.data.code } });
  if (existing) throw new AppError("VALIDATION", "Kód už existuje.");

  const reason = await prisma.crm_lost_reasons.create({ data: parsed.data });

  await writeCrmAuditLog({
    user_id: admin.id,
    entity_type: "LostReason",
    entity_id: reason.id,
    action: "CREATE",
    diff: { code: reason.code, label: reason.label },
  });

  return NextResponse.json({ reason }, { status: 201 });
});
