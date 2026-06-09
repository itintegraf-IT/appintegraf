import { requireCrmRead } from "@/lib/crm/guards";
import { NextRequest, NextResponse } from "next/server";
import { withApiError } from "@/lib/crm/api-utils";
import { prisma } from "@/lib/db";
import { ActivityUpdateSchema } from "@/lib/crm/validators/activity";
import { AppError } from "@/lib/crm/errors";
import type { Role } from "@/lib/crm/rbac";

const EMAIL_LOCKED_FIELDS = ["type", "date", "note"] as const;
const EMAIL_LOCKED_FIELD_LABELS: Record<(typeof EMAIL_LOCKED_FIELDS)[number], string> = {
  type: "Typ",
  date: "Datum",
  note: "Poznámka",
};

function assertOwnerOrAdmin(user_id: number, role: Role, owner_id: number, action: "edit" | "delete"): void {
  if (role === "ADMIN" || owner_id === user_id) return;
  const verb = action === "edit" ? "Editovat" : "Smazat";
  throw new AppError("FORBIDDEN", `${verb} může jen vlastník nebo admin.`);
}

async function loadAndAuthorize(id: string, user_id: number, role: Role) {
  const a = await prisma.crm_activities.findUnique({
    where: { id },
    include: {
      owner: { select: { id: true, first_name: true, last_name: true, email: true } },
      assignee: { select: { id: true, first_name: true, last_name: true, email: true } },
    },
  });
  if (!a) throw new AppError("NOT_FOUND", "Aktivita nenalezena.");
  if (role === "ADMIN" || role === "VIEWER") return a;
  if (a.owner_id === user_id || a.assignee_id === user_id) return a;
  throw new AppError("FORBIDDEN", "Nemáš přístup k této aktivitě.");
}

export const GET = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  const { id } = await ctx.params;
  const activity = await loadAndAuthorize(id, user.id, user.role);
  return NextResponse.json({ activity });
});

export const PATCH = withApiError(async (req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže editovat.");
  const { id } = await ctx.params;
  const existing = await loadAndAuthorize(id, user.id, user.role);
  assertOwnerOrAdmin(user.id, user.role, existing.owner_id, "edit");
  const body: unknown = await req.json();
  const parsed = ActivityUpdateSchema.safeParse(body);
  if (!parsed.success) throw new AppError("VALIDATION", parsed.error.message);

  if (existing.type === "EMAIL") {
    for (const field of EMAIL_LOCKED_FIELDS) {
      if (parsed.data[field] !== undefined) {
        throw new AppError(
          "FORBIDDEN",
          `Pole "${EMAIL_LOCKED_FIELD_LABELS[field]}" nelze měnit u aktivity synchronizované z Outlooku.`,
        );
      }
    }
  }

  if (parsed.data.completed_at) {
    const ts = new Date(parsed.data.completed_at).getTime();
    if (Math.abs(ts - Date.now()) > 24 * 60 * 60 * 1000) {
      throw new AppError("VALIDATION", "completed_at musí být v rozsahu ±24 h od teď.");
    }
  }

  const activity = await prisma.crm_activities.update({
    where: { id: existing.id },
    data: {
      ...parsed.data,
      date: parsed.data.date ? new Date(parsed.data.date) : undefined,
      next_action_date: parsed.data.next_action_date
        ? new Date(parsed.data.next_action_date)
        : parsed.data.next_action_date,
      completed_at:
        parsed.data.completed_at === undefined
          ? undefined
          : parsed.data.completed_at === null
            ? null
            : new Date(parsed.data.completed_at),
    },
  });
  return NextResponse.json({ activity });
});

export const DELETE = withApiError(async (_req: NextRequest, ctx: { params: Promise<{ id: string }> }) => {
  const user = await requireCrmRead();
  if (user.role === "VIEWER") throw new AppError("FORBIDDEN", "Viewer nemůže mazat.");
  const { id } = await ctx.params;
  const existing = await loadAndAuthorize(id, user.id, user.role);
  assertOwnerOrAdmin(user.id, user.role, existing.owner_id, "delete");
  await prisma.crm_activities.delete({ where: { id: existing.id } });
  return NextResponse.json({ ok: true });
});
