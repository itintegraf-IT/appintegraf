import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { sendCalendarApprovalEmail } from "@/lib/email";

/**
 * POST /api/calendar/[id]/approve
 * Schválení nebo zamítnutí události (volá zástup NEBO vedoucí oddělení)
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

  // Oddělení žadatele: z události nebo z uživatele
  const departmentId =
    event.department_id ?? event.users?.department_id ?? null;

  // Vedoucí oddělení (pokud existuje)
  let managerId: number | null = null;
  if (departmentId && event.departments?.manager_id) {
    managerId = event.departments.manager_id;
  } else if (departmentId) {
    const dept = await prisma.departments.findUnique({
      where: { id: departmentId },
      select: { manager_id: true },
    });
    managerId = dept?.manager_id ?? null;
  }

  const isDeputy = event.deputy_id === userId;
  const isManager = managerId === userId;

  // --- ZÁSTUP: approval_status === "pending" ---
  if (isDeputy && event.approval_status === "pending") {
    const approvalNote = `Schváleno zástupem dne ${new Date().toLocaleDateString("cs-CZ")} (${event.users_deputy ? `${event.users_deputy.first_name} ${event.users_deputy.last_name}` : "Zástup"})`;
    const newDescription = event.description
      ? `${event.description}\n\n${approvalNote}`
      : approvalNote;

    if (action === "approve") {
      if (managerId && managerId !== userId) {
        // Existuje vedoucí → deputy_approved, notifikace vedoucímu
        const deputyName = event.users_deputy
          ? `${event.users_deputy.first_name} ${event.users_deputy.last_name}`
          : "Zástup";

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
              approver_id: managerId,
              approval_type: "manager",
              approval_order: 2,
              status: "pending",
            },
          }),
          prisma.notifications.create({
            data: {
              user_id: managerId,
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
              message: `${deputyName} schválil/a vaši událost „${event.title}“. Čeká na schválení vedoucím oddělení.`,
              type: "calendar_approved",
              link: `/calendar/${id}`,
            },
          }),
        ]);
        const manager = await prisma.users.findUnique({
          where: { id: managerId },
          select: { email: true, first_name: true, last_name: true },
        });
        if (manager?.email) {
          await sendCalendarApprovalEmail({
            toEmail: manager.email,
            toName: `${manager.first_name} ${manager.last_name}`.trim() || "Vedoucí",
            subject: "Událost čeká na schválení – INTEGRAF",
            message: `${deputyName} schválil/a událost „${event.title}“ od ${creatorName}. Událost čeká na vaše schválení.`,
            eventTitle: event.title,
            eventId: id,
          });
        }
      } else {
        // Žádný vedoucí → rovnou approved
        const deputyName = event.users_deputy
          ? `${event.users_deputy.first_name} ${event.users_deputy.last_name}`
          : "Zástup";

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
      }
    } else {
      // reject
      const deputyName = event.users_deputy
        ? `${event.users_deputy.first_name} ${event.users_deputy.last_name}`
        : "Zástup";

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

  // --- VEDOUCÍ: approval_status === "deputy_approved" ---
  if (isManager && event.approval_status === "deputy_approved") {
    const manager = await prisma.users.findUnique({
      where: { id: userId },
      select: { first_name: true, last_name: true },
    });
    const managerName = manager
      ? `${manager.first_name} ${manager.last_name}`
      : "Vedoucí";

    if (action === "approve") {
      const approvalNote = `Schváleno vedoucím dne ${new Date().toLocaleDateString("cs-CZ")} (${managerName})`;
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
            title: "Událost definitivně schválena",
            message: `${managerName} schválil/a vaši událost „${event.title}“.`,
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
            message: `${managerName} zamítl/a vaši událost „${event.title}“. Důvod: ${comment}`,
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
