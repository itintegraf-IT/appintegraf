import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageMaketyQueue } from "@/lib/makety-access";
import { sortMaketyProductionQueue } from "@/lib/makety-queue";
import { isMaketyWorkType, type MaketyWorkType } from "@/lib/makety-work-type";
import { GRAFIKA_QUEUE_STATUSES } from "@/lib/makety-grafika-status";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageMaketyQueue(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const workTypeRaw = req.nextUrl.searchParams.get("work_type") ?? "maketa";
  if (!isMaketyWorkType(workTypeRaw)) {
    return NextResponse.json({ error: "Neplatný typ zakázky" }, { status: 400 });
  }
  const workType = workTypeRaw as MaketyWorkType;

  const queueStatuses =
    workType === "grafika"
      ? [...GRAFIKA_QUEUE_STATUSES]
      : (["open", "in_progress"] as const);

  const rows = await prisma.makety.findMany({
    where: {
      work_type: workType,
      status: { in: [...queueStatuses] },
      assignee_user_id: { not: null },
    },
    include: {
      users_assignee: { select: { id: true, first_name: true, last_name: true } },
      users_creator: { select: { first_name: true, last_name: true } },
    },
  });

  const sorted = sortMaketyProductionQueue(rows);
  const byAssignee = new Map<
    number,
    {
      assignee: { id: number; first_name: string; last_name: string };
      items: typeof sorted;
    }
  >();

  for (const row of sorted) {
    const aid = row.assignee_user_id!;
    const assignee = row.users_assignee!;
    if (!byAssignee.has(aid)) {
      byAssignee.set(aid, {
        assignee: {
          id: assignee.id,
          first_name: assignee.first_name,
          last_name: assignee.last_name,
        },
        items: [],
      });
    }
    byAssignee.get(aid)!.items.push(row);
  }

  const groups = [...byAssignee.values()].sort((a, b) =>
    `${a.assignee.last_name} ${a.assignee.first_name}`.localeCompare(
      `${b.assignee.last_name} ${b.assignee.first_name}`,
      "cs"
    )
  );

  return NextResponse.json({
    work_type: workType,
    groups: groups.map((g) => ({
      assignee: g.assignee,
      items: g.items.map((r) => ({
        work_type: r.work_type,
        id: r.id,
        body: r.body,
        order_number: r.order_number,
        priority: r.priority,
        queue_position: r.queue_position,
        due_at: r.due_at,
        status: r.status,
        assignee_user_id: r.assignee_user_id,
        creator: r.users_creator
          ? `${r.users_creator.first_name} ${r.users_creator.last_name}`
          : null,
      })),
    })),
  });
}
