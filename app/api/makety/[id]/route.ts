import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa, userCanEditMaketa } from "@/lib/makety-access";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";
import { parseMaketaPriority } from "@/lib/makety-status";
import { maketyAssigneeRoleLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { userHasMaketyGrafikaRole } from "@/lib/makety-grafika-users";
import { userHasMaketyVyrobaRole } from "@/lib/makety-vyroba-users";

const includeDetail = {
  users_assignee: { select: { id: true, first_name: true, last_name: true } },
  users_creator: { select: { id: true, first_name: true, last_name: true } },
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
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanViewMaketa(userId, id))) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  const maketa = await prisma.makety.findUnique({
    where: { id },
    include: includeDetail,
  });

  if (!maketa) {
    return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
  }

  return NextResponse.json({ maketa });
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
  if (!(await hasModuleAccess(userId, "makety", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanEditMaketa(userId, id))) {
    return NextResponse.json({ error: "Maketu upravit může jen její zadavatel" }, { status: 403 });
  }

  try {
    const existing = await prisma.makety.findUnique({
      where: { id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Maketa nenalezena" }, { status: 404 });
    }

    const body = await req.json();
    const nextBody =
      typeof body.body === "string" ? body.body.trim() : existing.body;
    const nextOrder =
      typeof body.order_number === "string"
        ? body.order_number.trim() || null
        : existing.order_number;
    const nextMaterial =
      typeof body.material === "string" ? body.material.trim() || null : existing.material;
    const nextDimensions =
      typeof body.dimensions === "string" ? body.dimensions.trim() || null : existing.dimensions;
    const nextPriority =
      typeof body.priority === "string"
        ? parseMaketaPriority(body.priority)
        : existing.priority;
    const nextStatus =
      typeof body.status === "string" ? body.status.trim() : existing.status;

    let nextQuantity: number | null = existing.quantity;
    if ("quantity" in body) {
      if (body.quantity === null || body.quantity === "") {
        nextQuantity = null;
      } else {
        const n = parseInt(String(body.quantity), 10);
        if (Number.isNaN(n) || n < 1) {
          return NextResponse.json({ error: "Neplatný počet kusů" }, { status: 400 });
        }
        nextQuantity = n;
      }
    }

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
        const wt = (existing.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
        const roleLabel = maketyAssigneeRoleLabel(wt);
        const hasRole =
          wt === "grafika" ? await userHasMaketyGrafikaRole(n) : await userHasMaketyVyrobaRole(n);
        if (!hasRole) {
          return NextResponse.json(
            { error: `Vybraný uživatel nemá roli ${roleLabel}` },
            { status: 400 }
          );
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

    if (nextAssignee == null) {
      const wt = (existing.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
      return NextResponse.json(
        { error: `Musí být vybrán uživatel s rolí ${maketyAssigneeRoleLabel(wt)}` },
        { status: 400 }
      );
    }

    if (!nextBody) {
      return NextResponse.json({ error: "Popis nesmí být prázdný" }, { status: 400 });
    }

    await prisma.makety.update({
      where: { id },
      data: {
        body: nextBody,
        order_number: nextOrder,
        material: nextMaterial,
        dimensions: nextDimensions,
        quantity: nextQuantity,
        priority: nextPriority,
        due_at: nextDue,
        assignee_user_id: nextAssignee,
        status: nextStatus,
      },
    });

    if (dueChanged) {
      await notifyMaketaRecipients({
        maketaId: id,
        bodyPreview: nextBody,
        orderNumber: nextOrder,
        kind: "deadline_changed",
        assigneeUserId: nextAssignee,
      });
    }

    const maketa = await prisma.makety.findUnique({
      where: { id },
      include: includeDetail,
    });

    return NextResponse.json({ success: true, maketa });
  } catch (e) {
    console.error("PUT /api/makety/[id]", e);
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
  if (!(await hasModuleAccess(userId, "makety", "write"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanEditMaketa(userId, id))) {
    return NextResponse.json({ error: "Smazat může jen zadavatel" }, { status: 403 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: "makety", record_id: id },
    select: { id: true },
  });
  if (files.length > 0) {
    await prisma.file_uploads.deleteMany({ where: { module: "makety", record_id: id } });
  }

  await prisma.makety.delete({ where: { id } });
  return NextResponse.json({ success: true });
}
