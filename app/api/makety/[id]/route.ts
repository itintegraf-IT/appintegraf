import { NextRequest, NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanViewMaketa, userCanEditMaketa, userCanDeleteMaketa } from "@/lib/makety-access";
import { revalidateMaketyViews } from "@/lib/makety-revalidate";
import { notifyMaketaRecipients } from "@/lib/makety-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";
import { parseMaketyDataKind } from "@/lib/makety-data-kind";
import { parseMaketaPriority } from "@/lib/makety-status";
import { maketyAssigneeRoleLabel, type MaketyWorkType } from "@/lib/makety-work-type";
import { userHasMaketyGrafikaRole } from "@/lib/makety-grafika-users";
import { userHasMaketyVyrobaRole } from "@/lib/makety-vyroba-users";
import {
  parseMaketyImlFieldsFromInput,
  resolveMaketyImlFields,
} from "@/lib/makety-iml-fields";
import { resolveGrafikaWorkflowAssignees } from "@/lib/makety-workflow-assignees";

const includeDetail = {
  users_assignee: { select: { id: true, first_name: true, last_name: true } },
  users_creator: { select: { id: true, first_name: true, last_name: true } },
  users_prepress: { select: { id: true, first_name: true, last_name: true } },
  users_final_approver: { select: { id: true, first_name: true, last_name: true } },
  iml_customers: { select: { id: true, name: true, email: true } },
  iml_products: {
    select: {
      id: true,
      ig_code: true,
      client_code: true,
      ig_short_name: true,
      client_name: true,
    },
  },
  iml_die_cuts: {
    select: {
      id: true,
      label_shape_code: true,
      die_cut_tool_code: true,
      internal_name: true,
    },
  },
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

    const workTypeEarly = (existing.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
    const nextDataKind =
      workTypeEarly === "grafika" && typeof body.data_kind === "string"
        ? parseMaketyDataKind(body.data_kind)
        : existing.data_kind;

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
      const wtMissing = (existing.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
      return NextResponse.json(
        { error: `Musí být vybrán uživatel s rolí ${maketyAssigneeRoleLabel(wtMissing)}` },
        { status: 400 }
      );
    }

    if (!nextBody) {
      return NextResponse.json({ error: "Popis nesmí být prázdný" }, { status: 400 });
    }

    const workType = (existing.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
    let imlUpdate: {
      customer_id: number | null;
      product_id: number | null;
      die_cut_id: number | null;
      label_code: string | null;
      job_number: string | null;
    } = {
      customer_id: existing.customer_id,
      product_id: existing.product_id,
      die_cut_id: existing.die_cut_id,
      label_code: existing.label_code,
      job_number: existing.job_number,
    };

    if (workType === "grafika") {
      const hasImlKey =
        "customer_id" in body ||
        "product_id" in body ||
        "die_cut_id" in body ||
        "label_code" in body ||
        "job_number" in body;
      if (hasImlKey) {
        const imlParsed = parseMaketyImlFieldsFromInput(body as Record<string, unknown>);
        if ("error" in imlParsed) {
          return NextResponse.json({ error: imlParsed.error }, { status: 400 });
        }
        const imlFields = await resolveMaketyImlFields(workType, imlParsed);
        if ("error" in imlFields) {
          return NextResponse.json({ error: imlFields.error }, { status: 400 });
        }
        imlUpdate = imlFields;
      }
    }

    let workflowUpdate: {
      prepress_user_id: number | null;
      final_approver_user_id: number | null;
    } = {
      prepress_user_id: existing.prepress_user_id,
      final_approver_user_id: existing.final_approver_user_id,
    };

    if (workType === "grafika" && ("prepress_user_id" in body || "final_approver_user_id" in body)) {
      const prepressRaw =
        "prepress_user_id" in body
          ? body.prepress_user_id === null || body.prepress_user_id === ""
            ? null
            : parseInt(String(body.prepress_user_id), 10)
          : existing.prepress_user_id;
      const finalRaw =
        "final_approver_user_id" in body
          ? body.final_approver_user_id === null || body.final_approver_user_id === ""
            ? null
            : parseInt(String(body.final_approver_user_id), 10)
          : existing.final_approver_user_id;
      if (prepressRaw != null && Number.isNaN(prepressRaw)) {
        return NextResponse.json({ error: "Neplatný schvalovatel prepress" }, { status: 400 });
      }
      if (finalRaw != null && Number.isNaN(finalRaw)) {
        return NextResponse.json({ error: "Neplatný finální schvalovatel" }, { status: 400 });
      }
      const workflow = await resolveGrafikaWorkflowAssignees(
        workType,
        nextAssignee!,
        prepressRaw,
        finalRaw
      );
      if ("error" in workflow) {
        return NextResponse.json({ error: workflow.error }, { status: 400 });
      }
      workflowUpdate = {
        prepress_user_id: workflow.prepress_user_id,
        final_approver_user_id: workflow.final_approver_user_id,
      };
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
        data_kind: nextDataKind,
        due_at: nextDue,
        assignee_user_id: nextAssignee,
        ...(workType === "grafika" ? { ...imlUpdate, ...workflowUpdate } : {}),
      },
    });

    if (dueChanged) {
      await notifyMaketaRecipients({
        maketaId: id,
        bodyPreview: nextBody,
        orderNumber: nextOrder,
        kind: "deadline_changed",
        assigneeUserId: nextAssignee,
        workType,
      });
    }

    const maketa = await prisma.makety.findUnique({
      where: { id },
      include: includeDetail,
    });

    revalidateMaketyViews();
    revalidatePath(`/makety/${id}`);
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

  const id = parseInt((await params).id, 10);
  if (Number.isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  if (!(await userCanDeleteMaketa(userId, id))) {
    return NextResponse.json({ error: "Nemáte oprávnění smazat zakázku" }, { status: 403 });
  }

  const files = await prisma.file_uploads.findMany({
    where: { module: "makety", record_id: id },
    select: { id: true },
  });
  if (files.length > 0) {
    await prisma.file_uploads.deleteMany({ where: { module: "makety", record_id: id } });
  }

  await prisma.makety.delete({ where: { id } });
  revalidateMaketyViews();
  return NextResponse.json({ success: true });
}
