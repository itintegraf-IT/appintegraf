import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMaketyQueue } from "@/lib/makety-access";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";
import { isMaketyWorkType, type MaketyWorkType } from "@/lib/makety-work-type";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageMaketyQueue(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  try {
    const body = await req.json();
    const workTypeRaw = String(body.work_type ?? "");
    if (!isMaketyWorkType(workTypeRaw)) {
      return NextResponse.json({ error: "Neplatný typ zakázky" }, { status: 400 });
    }
    const workType = workTypeRaw as MaketyWorkType;

    const assignee_user_id = parseInt(String(body.assignee_user_id ?? ""), 10);
    if (Number.isNaN(assignee_user_id)) {
      return NextResponse.json({ error: "Neplatný uživatel" }, { status: 400 });
    }

    const orderedIds = body.orderedIds;
    if (!Array.isArray(orderedIds) || orderedIds.length === 0) {
      return NextResponse.json({ error: "Chybí pořadí zakázek" }, { status: 400 });
    }

    const ids = orderedIds.map((id: unknown) => parseInt(String(id), 10));
    if (ids.some((id) => Number.isNaN(id))) {
      return NextResponse.json({ error: "Neplatné ID zakázky" }, { status: 400 });
    }

    const rows = await prisma.makety.findMany({
      where: {
        id: { in: ids },
        work_type: workType,
        assignee_user_id,
        status: { in: ["open", "in_progress"] },
      },
      select: { id: true },
    });

    if (rows.length !== ids.length) {
      return NextResponse.json(
        { error: "Některé zakázky nepatří do této fronty nebo nejsou aktivní" },
        { status: 400 }
      );
    }

    await prisma.$transaction(
      ids.map((id, index) =>
        prisma.makety.update({
          where: { id },
          data: { queue_position: (index + 1) * 1000 },
        })
      )
    );

    revalidateMaketyViews();
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("POST /api/makety/queue/reorder", e);
    return NextResponse.json({ error: "Chyba při změně pořadí" }, { status: 500 });
  }
}
