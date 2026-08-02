import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { canEditCard } from "@/lib/projekty/rbac";
import { ChecklistUpdateSchema } from "@/lib/projekty/validators/checklist";
import { loadChecklistForRBAC } from "@/lib/projekty/checklist-rbac";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { checklist, card } = await loadChecklistForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš editovat tento checklist.");
  }

  const body: unknown = await req.json();
  const parsed = ChecklistUpdateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const updated = await audited.checklist.update({
    where: { id: checklist.id },
    data: parsed.data,
  });

  return NextResponse.json({ checklist: updated });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const { checklist, card } = await loadChecklistForRBAC(id);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš mazat checklisty.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.checklist.delete({ where: { id: checklist.id } });

  return NextResponse.json({ ok: true });
});
