import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { UpdatePersonalTodoSchema } from "@/lib/projekty/validators/personal-todo";

type Params = { params: Promise<{ id: string }> };

export const PATCH = withApiError(async (req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const existing = await prisma.personalTodo.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== user.id) {
    throw new AppError("NOT_FOUND", "Úkol nenalezen.");
  }

  const body: unknown = await req.json();
  const parsed = UpdatePersonalTodoSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const data: Record<string, unknown> = {};
  if (parsed.data.title !== undefined) data.title = parsed.data.title;
  if (parsed.data.description !== undefined) data.description = parsed.data.description;
  if (parsed.data.dueDate !== undefined) {
    data.dueDate = parsed.data.dueDate ? new Date(parsed.data.dueDate) : null;
  }
  if (parsed.data.status !== undefined) {
    data.status = parsed.data.status;
    // completedAt sync — jen při přechodu DO/Z stavu DONE
    if (parsed.data.status === "DONE" && existing.status !== "DONE") {
      data.completedAt = new Date();
    } else if (parsed.data.status !== "DONE" && existing.status === "DONE") {
      data.completedAt = null;
    }
  }

  const audited = getPrismaAudited(user.id);
  const todo = await audited.personalTodo.update({ where: { id }, data });
  return NextResponse.json({ todo });
});

export const DELETE = withApiError(async (_req: Request, { params }: Params) => {
  const user = await requireSession();
  const { id } = await params;

  const existing = await prisma.personalTodo.findUnique({ where: { id } });
  if (!existing || existing.ownerId !== user.id) {
    throw new AppError("NOT_FOUND", "Úkol nenalezen.");
  }

  const audited = getPrismaAudited(user.id);
  await audited.personalTodo.delete({ where: { id } });
  return NextResponse.json({ ok: true });
});
