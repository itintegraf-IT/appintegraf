import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canApproveVehicleReservation } from "@/lib/resource-reservation-access";
import {
  approveResourceReservation,
  rejectResourceReservation,
  runInReservationTransaction,
} from "@/lib/resource-reservation-create";

/** POST /api/calendar/reservations/[id]/approve */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }

  const userId = parseInt(session.user.id, 10);
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const reservation = await prisma.resource_reservations.findUnique({
    where: { id },
    select: { id: true, approval_status: true, assigned_approver_id: true },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  if (
    !(await canApproveVehicleReservation(userId, {
      approval_status: reservation.approval_status,
      assigned_approver_id: reservation.assigned_approver_id,
    }))
  ) {
    return NextResponse.json({ error: "Nemáte oprávnění schvalovat tuto rezervaci" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const action = body.action === "reject" ? "reject" : "approve";
  const comment = typeof body.comment === "string" ? body.comment.trim() : "";

  if (action === "reject" && !comment) {
    return NextResponse.json({ error: "U zamítnutí je důvod povinný" }, { status: 400 });
  }

  try {
    await runInReservationTransaction(async (db) => {
      if (action === "approve") {
        await approveResourceReservation(db, id, userId);
      } else {
        await rejectResourceReservation(db, id, userId, comment);
      }
    });
    const updated = await prisma.resource_reservations.findUnique({ where: { id } });
    return NextResponse.json({ reservation: updated });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Chyba při zpracování" },
      { status: 400 }
    );
  }
}
