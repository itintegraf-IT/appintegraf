import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { ActivityCreateSchema } from "@/lib/crm/validators/activity";
import { AppError } from "@/lib/crm/errors";
import { canAccessParent } from "@/lib/crm/rbac";
import type { crm_parent_type } from "@prisma/client";

export const GET = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  const url = new URL(req.url);
  const parent_type = url.searchParams.get("parent_type") as crm_parent_type | null;
  const parent_id = url.searchParams.get("parent_id");
  const assigneeMine = url.searchParams.get("assignee") === "me";
  const where: Record<string, unknown> = {};
  if (parent_type && parent_id) {
    const ok = await canAccessParent(user, parent_type, parent_id);
    if (!ok) throw new AppError("FORBIDDEN", "Nemáš přístup k tomuto záznamu.");
    where.parent_type = parent_type;
    where.parent_id = parent_id;
  } else if (user.role === "SALES") {
    where.OR = [{ owner_id: user.id }, { assignee_id: user.id }];
  }
  if (assigneeMine) where.assignee_id = user.id;
  const activities = await prisma.crm_activities.findMany({
    where,
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
    orderBy: { date: "desc" },
    take: 200,
  });
  return NextResponse.json({ activities });
});

export const POST = withApiError(async (req: NextRequest) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže vytvářet aktivity.");
  const body: unknown = await req.json();
  const parsed = ActivityCreateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);
  const ok = await canAccessParent(user, parsed.data.parent_type, parsed.data.parent_id, "write");
  if (!ok) throw new AppError("FORBIDDEN", "Nemůžeš přidat aktivitu k tomuto záznamu.");
  const activity = await prisma.crm_activities.create({
    data: {
      ...parsed.data,
      date: new Date(parsed.data.date),
      next_action_date: parsed.data.next_action_date ? new Date(parsed.data.next_action_date) : null,
      owner_id: user.id,
    },
  });
  return NextResponse.json({ activity }, { status: 201 });
});
