import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { buildMaketyListWhere, canZadatMaketyWork } from "@/lib/makety-access";
import { notifyGrafikaWorkflowCreated, notifyMaketaRecipients } from "@/lib/makety-notify";
import { parseDateTimeLocalInput } from "@/lib/datetime-cz";
import { parseMaketyDataKind } from "@/lib/makety-data-kind";
import { parseMaketaPriority, maketyActiveWhereClause } from "@/lib/makety-status";
import { maketyAssigneeRoleLabel, parseMaketyWorkType } from "@/lib/makety-work-type";
import { userHasMaketyGrafikaRole } from "@/lib/makety-grafika-users";
import {
  nextQueuePositionForAssignee,
  sortMaketyProductionQueueByAssignee,
} from "@/lib/makety-queue";
import { userHasMaketyVyrobaRole } from "@/lib/makety-vyroba-users";
import {
  parseMaketyImlFieldsFromInput,
  resolveMaketyImlFields,
} from "@/lib/makety-iml-fields";
import { resolveGrafikaWorkflowAssignees } from "@/lib/makety-workflow-assignees";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canAccessMaketyModule(userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const where = await buildMaketyListWhere(userId, maketyActiveWhereClause());

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
    const data_kind =
      work_type === "grafika"
        ? parseMaketyDataKind(String(formData.get("data_kind") ?? "nova_data"))
        : "nova_data";

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

    const isMaketaPlotr = work_type === "maketa";
    const queue_position = isMaketaPlotr
      ? null
      : await nextQueuePositionForAssignee(work_type, assignee_user_id);

    const imlParsed = parseMaketyImlFieldsFromInput(formData);
    if ("error" in imlParsed) {
      return NextResponse.json({ error: imlParsed.error }, { status: 400 });
    }
    const imlFields = await resolveMaketyImlFields(work_type, imlParsed);
    if ("error" in imlFields) {
      return NextResponse.json({ error: imlFields.error }, { status: 400 });
    }

    const prepressRaw = String(formData.get("prepress_user_id") ?? "").trim();
    const finalRaw = String(formData.get("final_approver_user_id") ?? "").trim();
    const prepressParsed = prepressRaw ? parseInt(prepressRaw, 10) : null;
    const finalParsed = finalRaw ? parseInt(finalRaw, 10) : null;
    if (prepressRaw && (prepressParsed == null || Number.isNaN(prepressParsed))) {
      return NextResponse.json({ error: "Neplatný schvalovatel prepress" }, { status: 400 });
    }
    if (finalRaw && (finalParsed == null || Number.isNaN(finalParsed))) {
      return NextResponse.json({ error: "Neplatný finální schvalovatel" }, { status: 400 });
    }

    const workflow = await resolveGrafikaWorkflowAssignees(
      work_type,
      assignee_user_id,
      prepressParsed,
      finalParsed
    );
    if ("error" in workflow) {
      return NextResponse.json({ error: workflow.error }, { status: 400 });
    }

    const created = await prisma.makety.create({
      data: {
        body,
        order_number,
        material,
        dimensions,
        quantity,
        priority,
        data_kind,
        queue_position,
        due_at,
        assignee_user_id: workflow.assignee_user_id,
        created_by: userId,
        work_type,
        status: isMaketaPlotr ? "awaiting_quote" : "open",
        customer_id: imlFields.customer_id,
        product_id: imlFields.product_id,
        die_cut_id: imlFields.die_cut_id,
        label_code: imlFields.label_code,
        product_name: imlFields.product_name,
        job_number: imlFields.job_number,
        prepress_user_id: workflow.prepress_user_id,
        final_approver_user_id: workflow.final_approver_user_id,
      },
    });

    if (work_type === "grafika") {
      await notifyGrafikaWorkflowCreated({
        maketaId: created.id,
        bodyPreview: body,
        orderNumber: order_number,
        assigneeUserId: workflow.assignee_user_id,
        prepressUserId: workflow.prepress_user_id,
        finalApproverUserId: workflow.final_approver_user_id,
        excludeUserId: userId,
      });
    } else {
      await notifyMaketaRecipients({
        maketaId: created.id,
        bodyPreview: body,
        orderNumber: order_number,
        kind: "assigned",
        assigneeUserId: workflow.assignee_user_id,
        workType: work_type,
      });
    }

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
