import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { validateWorkflowStepsForSave } from "@/lib/contracts/workflow-template-validation";

const typeInclude = {
  contract_workflow_steps: {
    orderBy: { step_order: "asc" as const },
    include: {
      users_fixed: { select: { id: true, first_name: true, last_name: true } },
    },
  },
  _count: { select: { contracts: true } },
} as const;

type RouteCtx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const contract_type = await prisma.contract_types.findUnique({
    where: { id },
    include: typeInclude,
  });

  if (!contract_type) {
    return NextResponse.json({ error: "Typ nenalezen" }, { status: 404 });
  }

  return NextResponse.json({ contract_type });
}

export async function PUT(req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.contract_types.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Typ nenalezen" }, { status: 404 });
  }

  try {
    const body = await req.json();
    const name = typeof body.name === "string" ? body.name.trim() : "";
    if (!name) {
      return NextResponse.json({ error: "Vyplňte název typu smlouvy." }, { status: 400 });
    }

    const codeRaw = body.code;
    const code =
      typeof codeRaw === "string" && codeRaw.trim() ? codeRaw.trim().slice(0, 50) : null;

    const description =
      typeof body.description === "string" ? body.description.trim() || null : null;

    const sortOrder = Number(body.sort_order);
    const sort_order = Number.isFinite(sortOrder) ? Math.floor(sortOrder) : 0;

    const is_active = body.is_active !== false;

    const validated = validateWorkflowStepsForSave(body.steps ?? []);
    if (!validated.ok) {
      return NextResponse.json({ error: validated.message }, { status: 400 });
    }

    try {
      const updated = await prisma.$transaction(async (tx) => {
        await tx.contract_types.update({
          where: { id },
          data: {
            name: name.slice(0, 100),
            code,
            description,
            sort_order,
            is_active,
            updated_at: new Date(),
          },
        });

        await tx.contract_workflow_steps.deleteMany({ where: { contract_type_id: id } });

        await tx.contract_workflow_steps.createMany({
          data: validated.normalized.map((s) => ({
            contract_type_id: id,
            step_order: s.step_order,
            resolver: s.resolver,
            fixed_user_id: s.fixed_user_id,
          })),
        });

        return tx.contract_types.findUnique({
          where: { id },
          include: typeInclude,
        });
      });

      return NextResponse.json({ contract_type: updated });
    } catch (e: unknown) {
      const msg = e && typeof e === "object" && "code" in e ? String((e as { code?: string }).code) : "";
      if (msg === "P2002") {
        return NextResponse.json(
          { error: "Kód typu musí být unikátní (již existuje)." },
          { status: 400 }
        );
      }
      throw e;
    }
  } catch (e) {
    console.error("admin contract-types PUT:", e);
    return NextResponse.json({ error: "Chyba při ukládání typu smlouvy." }, { status: 500 });
  }
}

export async function DELETE(_req: NextRequest, ctx: RouteCtx) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const { id: idRaw } = await ctx.params;
  const id = parseInt(idRaw, 10);
  if (!Number.isFinite(id) || id < 1) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const row = await prisma.contract_types.findUnique({
    where: { id },
    include: { _count: { select: { contracts: true } } },
  });

  if (!row) {
    return NextResponse.json({ error: "Typ nenalezen" }, { status: 404 });
  }

  if (row._count.contracts > 0) {
    return NextResponse.json(
      {
        error:
          "Typ nelze smazat – existují k němu smlouvy. Deaktivujte typ nebo přesuňte smlouvy.",
      },
      { status: 409 }
    );
  }

  await prisma.contract_types.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
