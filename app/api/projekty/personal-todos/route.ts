import { NextResponse } from "next/server";
import { withApiError, getPrismaAudited } from "@/lib/projekty/api-utils";
import { requireSession } from "@/lib/projekty/session";
import { AppError } from "@/lib/projekty/errors";
import { prisma } from "@/lib/projekty/prisma";
import { CreatePersonalTodoSchema } from "@/lib/projekty/validators/personal-todo";

const STATUS_RANK: Record<string, number> = { NOT_STARTED: 0, IN_PROGRESS: 1, DONE: 2 };

export const GET = withApiError(async (req: Request) => {
  const user = await requireSession();
  const url = new URL(req.url);
  const archived = url.searchParams.get("archived") === "true";
  // Filter "completed=true/false" zachovaný pro zpětnou kompatibilitu:
  //  true  → status === "DONE"; false → status !== "DONE"
  const completedParam = url.searchParams.get("completed");

  const where: {
    ownerId: number;
    archivedAt: { not: null } | null;
    status?: "DONE" | { not: "DONE" };
  } = {
    ownerId: user.id,
    archivedAt: archived ? { not: null } : null,
  };
  if (completedParam !== null) {
    where.status = completedParam === "true" ? "DONE" : { not: "DONE" };
  }

  const todos = await prisma.personalTodo.findMany({
    where,
    orderBy: { createdAt: "desc" },
    include: archived
      ? {
          promotedToCard: {
            select: {
              id: true,
              number: true,
              title: true,
              list: { select: { boardId: true } },
            },
          },
        }
      : undefined,
  });

  // Řazení v JS (MySQL neumí spolehlivě NULLS LAST): status, pak dueDate (bez termínu poslední), pak nejnovější.
  todos.sort((a, b) => {
    const sr = (STATUS_RANK[a.status] ?? 9) - (STATUS_RANK[b.status] ?? 9);
    if (sr !== 0) return sr;
    if (a.dueDate && b.dueDate) {
      const d = a.dueDate.getTime() - b.dueDate.getTime();
      if (d !== 0) return d;
    } else if (a.dueDate) return -1;
    else if (b.dueDate) return 1;
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return NextResponse.json({ todos });
});

export const POST = withApiError(async (req: Request) => {
  const user = await requireSession();
  const body: unknown = await req.json();
  const parsed = CreatePersonalTodoSchema.safeParse(body);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Validace selhala.");
  }

  const audited = getPrismaAudited(user.id);
  const todo = await audited.personalTodo.create({
    data: {
      ownerId: user.id,
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      dueDate: parsed.data.dueDate ? new Date(parsed.data.dueDate) : null,
    },
  });
  return NextResponse.json({ todo }, { status: 201 });
});
