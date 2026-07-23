import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { loadCardForRBAC } from "@/lib/projekty/board-rbac";
import { canEditCard } from "@/lib/projekty/rbac";
import { ChecklistCreateSchema } from "@/lib/projekty/validators/checklist";
import { between } from "@/lib/projekty/position";

type Params = { params: Promise<{ id: string }> };

export const POST = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id: cardId } = await params;

  const card = await loadCardForRBAC(cardId);
  if (!canEditCard(user, card)) {
    throw new AppError("FORBIDDEN", "Nemůžeš přidávat checklisty.");
  }

  const body: unknown = await req.json();
  const parsed = ChecklistCreateSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const last = await prisma.checklist.findFirst({
    where: { cardId },
    orderBy: { position: "desc" },
    select: { position: true },
  });
  const position = between(last?.position ?? null, null);

  const audited = getPrismaAudited(user.id);
  const checklist = await audited.checklist.create({
    data: { cardId, name: parsed.data.name, position },
    include: { items: { orderBy: { position: "asc" } } },
  });

  return NextResponse.json({ checklist }, { status: 201 });
});
