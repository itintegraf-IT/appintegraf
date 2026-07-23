import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { canEditCard } from "@/lib/projekty/rbac";
import { loadChecklistForRBAC } from "@/lib/projekty/checklist-rbac";
import { ChecklistItemCreateSchema } from "@/lib/projekty/validators/checklist";
import { between } from "@/lib/projekty/position";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: checklistId } = await params;

  const { card } = await loadChecklistForRBAC(checklistId);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přidávat položky.");
  }

  const body: unknown = await req.json();
  const parsed = ChecklistItemCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const last = await prisma.checklistItem.findFirst({
    where: { checklistId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = between(last?.position ?? null, null);

  const audited = getPrismaAudited(user.id);
  const item = await audited.checklistItem.create({
    data: { checklistId, text: parsed.data.text, position },
  });

  return NextResponse.json({ item }, { status: 201 });
});
