import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canAccessMaketyModule } from "@/lib/makety-module-access";
import { userCanCopyMaketa } from "@/lib/makety-access";
import { notifyGrafikaWorkflowCreated, notifyMaketaRecipients, notifySpravaVzorkuUpravaDat } from "@/lib/makety-notify";
import { nextQueuePositionForAssignee } from "@/lib/makety-queue";
import { resolveGrafikaWorkflowAssignees } from "@/lib/makety-workflow-assignees";
import type { MaketyWorkType } from "@/lib/makety-work-type";

/**
 * POST /api/makety/[id]/copy
 * Vytvoří novou zakázku se stejnými údaji (včetně IML vazeb).
 * Nekopíruje: soubory, komentáře, status log, nabídku/kalkulaci, product_draft.
 * Stav = výchozí (open / awaiting_quote). Přesměrování na edit nové zakázky řeší UI.
 */
export async function POST(
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

  if (!(await userCanCopyMaketa(userId, id))) {
    return NextResponse.json(
      { error: "Nemáte oprávnění kopírovat tuto zakázku" },
      { status: 403 }
    );
  }

  const source = await prisma.makety.findUnique({ where: { id } });
  if (!source) {
    return NextResponse.json({ error: "Zakázka nenalezena" }, { status: 404 });
  }

  const workType = (source.work_type === "grafika" ? "grafika" : "maketa") as MaketyWorkType;
  const isMaketaPlotr = workType === "maketa";

  if (!source.assignee_user_id) {
    return NextResponse.json(
      { error: "Zdrojová zakázka nemá přiřazeného řešitele — nelze zkopírovat" },
      { status: 400 }
    );
  }

  const workflow = await resolveGrafikaWorkflowAssignees(
    workType,
    source.assignee_user_id,
    source.prepress_user_id,
    source.final_approver_user_id
  );
  if ("error" in workflow) {
    return NextResponse.json({ error: workflow.error }, { status: 400 });
  }

  const queue_position = isMaketaPlotr
    ? null
    : await nextQueuePositionForAssignee(workType, workflow.assignee_user_id);

  const bodyCopy = source.body.trim().startsWith("Kopie:")
    ? source.body
    : `Kopie: ${source.body}`;

  try {
    const created = await prisma.makety.create({
      data: {
        body: bodyCopy,
        order_number: source.order_number,
        material: source.material,
        dimensions: source.dimensions,
        quantity: source.quantity,
        priority: source.priority,
        data_kind: source.data_kind,
        queue_position,
        due_at: source.due_at,
        assignee_user_id: workflow.assignee_user_id,
        created_by: userId,
        work_type: workType,
        status: isMaketaPlotr ? "awaiting_quote" : "open",
        customer_id: source.customer_id,
        product_id: source.product_id,
        die_cut_id: source.die_cut_id,
        label_code: source.label_code,
        product_name: source.product_name,
        job_number: source.job_number,
        prepress_user_id: workflow.prepress_user_id,
        final_approver_user_id: workflow.final_approver_user_id,
        // quote / product_draft / rejection záměrně nekopírujeme
      },
    });

    if (workType === "grafika") {
      await notifyGrafikaWorkflowCreated({
        maketaId: created.id,
        bodyPreview: bodyCopy,
        orderNumber: source.order_number,
        assigneeUserId: workflow.assignee_user_id,
        prepressUserId: workflow.prepress_user_id,
        finalApproverUserId: workflow.final_approver_user_id,
        excludeUserId: userId,
      });
      if (source.data_kind === "uprava_dat") {
        await notifySpravaVzorkuUpravaDat({
          maketaId: created.id,
          orderNumber: source.order_number,
          labelCode: source.label_code,
          productName: source.product_name,
          jobNumber: source.job_number,
          excludeUserId: userId,
        });
      }
    } else {
      await notifyMaketaRecipients({
        maketaId: created.id,
        bodyPreview: bodyCopy,
        orderNumber: source.order_number,
        kind: "assigned",
        assigneeUserId: workflow.assignee_user_id,
        workType,
      });
    }

    return NextResponse.json({ success: true, id: created.id });
  } catch (e) {
    console.error("POST /api/makety/[id]/copy", e);
    return NextResponse.json({ error: "Chyba při kopírování zakázky" }, { status: 500 });
  }
}
