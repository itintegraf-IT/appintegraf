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

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const contract_types = await prisma.contract_types.findMany({
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
    include: typeInclude,
  });

  return NextResponse.json({ contract_types });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
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
      const created = await prisma.$transaction(async (tx) => {
        const t = await tx.contract_types.create({
          data: {
            name: name.slice(0, 100),
            code,
            description,
            sort_order,
            is_active,
          },
        });

        await tx.contract_workflow_steps.createMany({
          data: validated.normalized.map((s) => ({
            contract_type_id: t.id,
            step_order: s.step_order,
            resolver: s.resolver,
            fixed_user_id: s.fixed_user_id,
          })),
        });

        return tx.contract_types.findUnique({
          where: { id: t.id },
          include: typeInclude,
        });
      });

      return NextResponse.json({ contract_type: created });
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
    console.error("admin contract-types POST:", e);
    return NextResponse.json({ error: "Chyba při ukládání typu smlouvy." }, { status: 500 });
  }
}
