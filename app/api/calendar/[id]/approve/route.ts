import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendCalendarApprovalEmail } from "@/lib/email";
import {
  formatApproverAssignmentNote,
  resolveDepartmentCalendarApprover,
} from "@/lib/calendar-approver-resolution";

/**
 * POST /api/calendar/[id]/approve
 * Schválení nebo zamítnutí události (zástup nebo finální schvalovatel)
 * Body: { action: "approve" | "reject", comment?: string }
 */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const userId = parseInt(session.user.id, 10);

  const event = await prisma.calendar_events.findUnique({
    where: { id },
    include: {
      users: {
        select: {
          id: true,
          first_name: true,
          last_name: true,
          department_id: true,
        },
      },
      users_deputy: { select: { id: true, first_name: true, last_name: true } },
      departments: { select: { id: true, manager_id: true, name: true } },
      calendar_approvals: {
        where: { status: "pending" },
        select: { id: true, approver_id: true, approval_type: true },
      },
    },
  });

  if (!event) {
    return NextResponse.json({ error: "Událost nenalezena" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (action === "reject" && !comment) {
    return NextResponse.json({ error: "U zamítnutí je důvod povinný" }, { status: 400 });
  }

  const creatorId = event.created_by;
  const creatorName = event.users
    ? `${event.users.first_name} ${event.users.last_name}`
    : "Žadatel";

  const departmentId =
    event.department_id ?? event.users?.department_id ?? null;

  const isDeputy = event.deputy_id === userId;
  const pendingFinalApproval = event.calendar_approvals.find(
    (a) =>
      a.approver_id === userId &&
      a.approval_type !== "deputy" &&
      event.approval_status === "deputy_approved"
  );
  const isFinalApprover = !!pendingFinalApproval;

  // --- ZÁSTUP: approval_status === "pending" ---
  if (isDeputy && event.approval_status === "pending") {
    const deputyName = event.users_deputy
      ? `${event.users_deputy.first_name} ${event.users_deputy.last_name}`
      : "Zástup";
    const approvalNote = `Schváleno zástupem dne ${new Date().toLocaleDateString("cs-CZ")} (${deputyName})`;

    if (action === "approve") {
      if (!departmentId) {
        const newDescription = event.description
          ? `${event.description}\n\n${approvalNote}`
          : approvalNote;
        await prisma.$transaction([
          prisma.calendar_events.update({
            where: { id },
            data: {
              approval_status: "approved",
              description: newDescription,
              updated_at: new Date(),
            },
          }),
          prisma.calendar_approvals.updateMany({
            where: { event_id: id, approver_id: userId },
            data: {
              status: "approved",
              comment: "Schváleno",
              approved_at: new Date(),
              updated_at: new Date(),
            },
          }),
          prisma.notifications.create({
            data: {
              user_id: creatorId,
              title: "Událost schválena",
              message: `${deputyName} schválil/a vaši událost „${event.title}“.`,
              type: "calendar_approved",
              link: `/calendar/${id}`,
            },
          }),
        ]);
        return NextResponse.json({
          success: true,
          action,
          message: "Událost byla schválena.",
        });
      }

      const resolved = await resolveDepartmentCalendarApprover(
        prisma,
        departmentId,
        event.start_date,
        event.end_date,
        id
      );

      if (!resolved || resolved.userId === userId) {
        return NextResponse.json(
          {
            error:
              "Nelze určit schvalovatele – nastavte schvalovatele oddělení nebo vedoucího v administraci.",
          },
          { status: 409 }
        );
      }

      const approver = await prisma.users.findUnique({
        where: { id: resolved.userId },
        select: { email: true, first_name: true, last_name: true },
      });
      const approverName = approver
        ? `${approver.first_name} ${approver.last_name}`.trim()
        : "Schvalovatel";

      const assignmentNote = formatApproverAssignmentNote(
        approverName,
        resolved.tier,
        resolved.skippedTiers
      );
      const newDescription = event.description
        ? `${event.description}\n\n${approvalNote}\n${assignmentNote}`
        : `${approvalNote}\n${assignmentNote}`;

      await prisma.$transaction([
        prisma.calendar_events.update({
          where: { id },
          data: {
            approval_status: "deputy_approved",
            description: newDescription,
            updated_at: new Date(),
          },
        }),
        prisma.calendar_approvals.updateMany({
          where: { event_id: id, approver_id: userId },
          data: {
            status: "approved",
            comment: "Schváleno",
            approved_at: new Date(),
            updated_at: new Date(),
          },
        }),
        prisma.calendar_approvals.create({
          data: {
            event_id: id,
            approver_id: resolved.userId,
            approval_type: resolved.tier,
            approval_order: 2,
            status: "pending",
          },
        }),
        prisma.notifications.create({
          data: {
            user_id: resolved.userId,
            title: "Událost čeká na schválení",
            message: `${deputyName} schválil/a událost „${event.title}“ od ${creatorName}. Událost čeká na vaše schválení.`,
            type: "calendar_approval",
            link: `/calendar/${id}`,
          },
        }),
        prisma.notifications.create({
          data: {
            user_id: creatorId,
            title: "Událost schválena zástupem",
            message: `${deputyName} schválil/a vaši událost „${event.title}“. Čeká na schválení: ${approverName}.`,
            type: "calendar_approved",
            link: `/calendar/${id}`,
          },
        }),
      ]);

      if (approver?.email) {
        await sendCalendarApprovalEmail({
          toEmail: approver.email,
          toName: approverName,
          subject: "Událost čeká na schválení – INTEGRAF",
          message: `${deputyName} schválil/a událost „${event.title}“ od ${creatorName}. Událost čeká na vaše schválení.`,
          eventTitle: event.title,
          eventId: id,
        });
      }
    } else {
      await prisma.$transaction([
        prisma.calendar_events.update({
          where: { id },
          data: { approval_status: "rejected", updated_at: new Date() },
        }),
        prisma.calendar_approvals.updateMany({
          where: { event_id: id, approver_id: userId },
          data: {
            status: "rejected",
            comment,
            updated_at: new Date(),
          },
        }),
        prisma.notifications.create({
          data: {
            user_id: creatorId,
            title: "Událost zamítnuta",
            message: `${deputyName} zamítl/a vaši událost „${event.title}“. Důvod: ${comment}`,
            type: "calendar_rejected",
            link: `/calendar/${id}`,
          },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === "approve" ? "Událost byla schválena." : "Událost byla zamítnuta.",
    });
  }

  // --- FINÁLNÍ SCHVALOVATEL: approval_status === "deputy_approved" ---
  if (isFinalApprover && event.approval_status === "deputy_approved") {
    const approver = await prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true },
    });
    const approverName = approver
      ? `${approver.first_name} ${approver.last_name}`
      : "Schvalovatel";

    if (action === "approve") {
      const approvalNote = `Schváleno schvalovatelem dne ${new Date().toLocaleDateString("cs-CZ")} (${approverName})`;
      const newDescription = event.description
        ? `${event.description}\n\n${approvalNote}`
        : approvalNote;

      await prisma.$transaction([
        prisma.calendar_events.update({
          where: { id },
          data: {
            approval_status: "approved",
            description: newDescription,
            updated_at: new Date(),
          },
        }),
        prisma.calendar_approvals.updateMany({
          where: { event_id: id, approver_id: userId, status: "pending" },
          data: {
            status: "approved",
            comment: "Schváleno",
            approved_at: new Date(),
            updated_at: new Date(),
          },
        }),
        prisma.notifications.create({
          data: {
            user_id: creatorId,
            title: "Událost definitivně schválena",
            message: `${approverName} schválil/a vaši událost „${event.title}“.`,
            type: "calendar_approved",
            link: `/calendar/${id}`,
          },
        }),
      ]);
    } else {
      await prisma.$transaction([
        prisma.calendar_events.update({
          where: { id },
          data: { approval_status: "rejected", updated_at: new Date() },
        }),
        prisma.calendar_approvals.updateMany({
          where: { event_id: id, approver_id: userId, status: "pending" },
          data: {
            status: "rejected",
            comment,
            updated_at: new Date(),
          },
        }),
        prisma.notifications.create({
          data: {
            user_id: creatorId,
            title: "Událost zamítnuta",
            message: `${approverName} zamítl/a vaši událost „${event.title}“. Důvod: ${comment}`,
            type: "calendar_rejected",
            link: `/calendar/${id}`,
          },
        }),
      ]);
    }

    return NextResponse.json({
      success: true,
      action,
      message: action === "approve" ? "Událost byla schválena." : "Událost byla zamítnuta.",
    });
  }

  return NextResponse.json(
    { error: "Nemáte oprávnění schvalovat tuto událost nebo ji již někdo zpracoval." },
    { status: 403 }
  );
}
