import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { canViewAllMakety } from "@/lib/makety-access";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";
import { parseMaketaPriority } from "@/lib/makety-status";
import { userHasMaketyVyrobaRole } from "@/lib/makety-vyroba-users";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const orgWide = await canViewAllMakety(userId);
  const where: Record<string, unknown> = {
    status: { notIn: ["done", "cancelled"] },
  };
  if (!orgWide) {
    where.OR = [{ created_by: userId }, { assignee_user_id: userId }];
  }

  const rows = await prisma.makety.findMany({
    where,
    orderBy: { due_at: "asc" },
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ makety: rows });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "makety", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění zadávat makety" }, { status: 403 });
  }

  try {
    const formData = await req.formData();
    const body = String(formData.get("body") ?? "").trim();
    const order_number = String(formData.get("order_number") ?? "").trim() || null;
    const material = String(formData.get("material") ?? "").trim() || null;
    const dimensions = String(formData.get("dimensions") ?? "").trim() || null;
    const quantityRaw = String(formData.get("quantity") ?? "").trim();
    const quantity = quantityRaw ? parseInt(quantityRaw, 10) : null;
    const priority = parseMaketaPriority(String(formData.get("priority") ?? "normal"));
    const dueRaw = String(formData.get("due_at") ?? "").trim();

    const assigneeRaw = String(formData.get("assignee_user_id") ?? "").trim();
    const assignee_user_id = assigneeRaw ? parseInt(assigneeRaw, 10) : null;
    if (!assigneeRaw || assignee_user_id == null || Number.isNaN(assignee_user_id)) {
      return NextResponse.json(
        { error: "Vyberte uživatele s rolí Výroba maket" },
        { status: 400 }
      );
    }

    if (!body) {
      return NextResponse.json({ error: "Vyplňte popis zakázky" }, { status: 400 });
    }
    if (!dueRaw) {
      return NextResponse.json({ error: "Vyplňte termín" }, { status: 400 });
    }
    const due_at = parseDateTimeLocalInput(dueRaw);
    if (Number.isNaN(due_at.getTime())) {
      return NextResponse.json({ error: "Neplatný termín" }, { status: 400 });
    }
    if (quantityRaw && (quantity == null || Number.isNaN(quantity) || quantity < 1)) {
      return NextResponse.json({ error: "Neplatný počet kusů" }, { status: 400 });
    }

    const assignee = await prisma.users.findFirst({
      where: { id: assignee_user_id, is_active: true },
      select: { id: true },
    });
    if (!assignee) {
      return NextResponse.json({ error: "Uživatel neexistuje nebo není aktivní" }, { status: 400 });
    }
    if (!(await userHasMaketyVyrobaRole(assignee_user_id))) {
      return NextResponse.json(
        { error: "Vybraný uživatel nemá roli Výroba maket" },
        { status: 400 }
      );
    }

    const created = await prisma.makety.create({
      data: {
        body,
        order_number,
        material,
        dimensions,
        quantity,
        priority,
        due_at,
        assignee_user_id,
        created_by: userId,
      },
    });

    await notifyMaketaRecipients({
      maketaId: created.id,
      bodyPreview: body,
      orderNumber: order_number,
      kind: "assigned",
      assigneeUserId: assignee_user_id,
    });

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("POST /api/makety", e);
    return NextResponse.json({ error: "Chyba při ukládání makety" }, { status: 500 });
  }
}
