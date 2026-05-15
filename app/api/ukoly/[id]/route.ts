import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { userCanViewUkol, userCanEditUkol } from "@/lib/ukoly-access";
import { notifyUkolRecipients } from "@/lib/ukoly-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";

const includeDetail = {
  users_assignee: { select: { id: true, first_name: true, last_name: true } },
  users_creator: { select: { id: true, first_name: true, last_name: true } },
  ukoly_departments: { include: { departments: { select: { id: true, name: true } } } },
} as const;

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewUkol(userId, id))) {
    return NextResponse.json({ error: "Úkol nenalezen" }, { status: 404 });
  }

  const ukol = await prisma.ukoly.findUnique({
    where: { id },
    include: includeDetail,
  });

  if (!ukol) {
    return NextResponse.json({ error: "Úkol nenalezen" }, { status: 404 });
  }

  return NextResponse.json({ ukol });
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanEditUkol(userId, id))) {
    return NextResponse.json({ error: "Úkol upravit může jen jeho zadavatel" }, { status: 403 });
  }

  try {
    const existing = await prisma.ukoly.findUnique({
      where: { id },
      include: { ukoly_departments: true },
    });
    if (!existing) {
      return NextResponse.json({ error: "Úkol nenalezen" }, { status: 404 });
    }

    const body = await req.json();
    const nextBody =
      typeof body.body === "string" ? body.body.trim() : existing.body;
    const nextOrder =
      typeof body.order_number === "string"
        ? body.order_number.trim() || null
        : existing.order_number;
    const nextUrgent =
      typeof body.urgent === "boolean" ? body.urgent : existing.urgent;
    const nextStatus =
      typeof body.status === "string" ? body.status.trim() : existing.status;

    let nextAssignee: number | null = existing.assignee_user_id;
    if ("assignee_user_id" in body) {
      if (body.assignee_user_id === null || body.assignee_user_id === "") {
        nextAssignee = null;
      } else {
        const n = parseInt(String(body.assignee_user_id), 10);
        if (Number.isNaN(n)) {
          return NextResponse.json({ error: "Neplatný uživatel" }, { status: 400 });
        }
        const u = await prisma.users.findFirst({
          where: { id: n, is_active: true },
          select: { id: true },
        });
        if (!u) {
          return NextResponse.json({ error: "Uživatel neexistuje" }, { status: 400 });
        }
        nextAssignee = n;
      }
    }

    let nextDue = existing.due_at;
    let dueChanged = false;
    if (typeof body.due_at === "string" && body.due_at.trim()) {
      const d = parseDateTimeLocalInput(body.due_at);
      if (Number.isNaN(d.getTime())) {
        return NextResponse.json({ error: "Neplatný termín" }, { status: 400 });
      }
      if (d.getTime() !== new Date(existing.due_at).getTime()) {
        dueChanged = true;
      }
      nextDue = d;
    }

    let deptIds: number[] = existing.ukoly_departments.map((x) => x.department_id);
    if (Array.isArray(body.department_ids)) {
      const parsed: number[] = body.department_ids
        .map((x: unknown) => parseInt(String(x), 10))
        .filter((n: number) => !Number.isNaN(n));
      deptIds = [...new Set(parsed)];
      const cnt = await prisma.departments.count({
        where: { id: { in: deptIds }, is_active: true },
      });
      if (cnt !== deptIds.length && deptIds.length > 0) {
        return NextResponse.json({ error: "Neplatné oddělení" }, { status: 400 });
      }
    }

    if (nextAssignee == null && deptIds.length === 0) {
      return NextResponse.json(
        { error: "Zůstat musí přiřazený uživatel a/nebo oddělení" },
        { status: 400 }
      );
    }

    if (!nextBody) {
      return NextResponse.json({ error: "Text úkolu nesmí být prázdný" }, { status: 400 });
    }

    await prisma.ukoly_departments.deleteMany({ where: { ukol_id: id } });
    await prisma.ukoly.update({
      where: { id },
      data: {
        body: nextBody,
        order_number: nextOrder,
        due_at: nextDue,
        urgent: nextUrgent,
        assignee_user_id: nextAssignee,
        status: nextStatus,
        ukoly_departments: {
          create: deptIds.map((department_id) => ({ department_id })),
        },
      },
    });

    if (dueChanged) {
      await notifyUkolRecipients({
        ukolId: id,
        bodyPreview: nextBody,
        orderNumber: nextOrder,
        kind: "deadline_changed",
        assigneeUserId: nextAssignee,
        departmentIds: deptIds,
      });
    }

    const ukol = await prisma.ukoly.findUnique({
      where: { id },
      include: includeDetail,
    });

    return NextResponse.json({ success: true, ukol });
  } catch (e) {
    console.error("PUT /api/ukoly/[id]", e);
    return NextResponse.json({ error: "Chyba při ukládání" }, { status: 500 });
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "ukoly", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanEditUkol(userId, id))) {
    return NextResponse.json({ error: "Smazat může jen zadavatel" }, { status: 403 });
  }

  await prisma.ukoly.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
