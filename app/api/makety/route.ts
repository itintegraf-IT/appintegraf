import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { buildMaketyListWhere, canZadatMaketyWork } from "@/lib/makety-access";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";
import { parseMaketaPriority } from "@/lib/makety-status";
import { maketyAssigneeRoleLabel, parseMaketyWorkType } from "@/lib/makety-work-type";
import { userHasMaketyGrafikaRole } from "@/lib/makety-grafika-users";
import {
  nextQueuePositionForAssignee,
  sortMaketyProductionQueueByAssignee,
} from "@/lib/makety-queue";
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

  const where = await buildMaketyListWhere(userId, {
    status: { notIn: ["done", "cancelled"] },
  });

  const rows = await prisma.makety.findMany({
    where,
    take: 200,
    include: {
      users_assignee: { select: { first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ makety: sortMaketyProductionQueueByAssignee(rows) });
}

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);

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

    const work_type = parseMaketyWorkType(String(formData.get("work_type") ?? "maketa"));

    if (!(await canZadatMaketyWork(userId, work_type))) {
      return NextResponse.json({ error: "Nemáte oprávnění zadávat tento typ zakázky" }, { status: 403 });
    }

    const assigneeRaw = String(formData.get("assignee_user_id") ?? "").trim();
    const assignee_user_id = assigneeRaw ? parseInt(assigneeRaw, 10) : null;
    const roleLabel = maketyAssigneeRoleLabel(work_type);
    if (!assigneeRaw || assignee_user_id == null || Number.isNaN(assignee_user_id)) {
      return NextResponse.json(
        { error: `Vyberte uživatele s rolí ${roleLabel}` },
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
    const hasRole =
      work_type === "grafika"
        ? await userHasMaketyGrafikaRole(assignee_user_id)
        : await userHasMaketyVyrobaRole(assignee_user_id);
    if (!hasRole) {
      return NextResponse.json(
        { error: `Vybraný uživatel nemá roli ${roleLabel}` },
        { status: 400 }
      );
    }

    const queue_position = await nextQueuePositionForAssignee(work_type, assignee_user_id);

    const created = await prisma.makety.create({
      data: {
        body,
        order_number,
        material,
        dimensions,
        quantity,
        priority,
        queue_position,
        due_at,
        assignee_user_id,
        created_by: userId,
        work_type,
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
    const msg = e instanceof Error ? e.message : String(e);
    if (
      e instanceof Prisma.PrismaClientValidationError &&
      msg.includes("work_type")
    ) {
      return NextResponse.json(
        {
          error:
            "Chybí sloupec work_type nebo není přegenerovaný Prisma klient. Spusťte: npm run db:makety-work-type && npx prisma generate, poté restartujte aplikaci.",
        },
        { status: 500 }
      );
    }
    return NextResponse.json({ error: "Chyba při ukládání makety" }, { status: 500 });
  }
}
