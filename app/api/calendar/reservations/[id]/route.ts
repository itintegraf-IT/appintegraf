import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canDeleteReservation,
  canEditReservation,
  canViewReservation,
} from "@/lib/resource-reservation-access";
import {
  runInReservationTransaction,
  updateResourceReservation,
} from "@/lib/resource-reservation-create";
import {
  findResourceReservationOverlap,
  formatResourceOverlapErrorCs,
} from "@/lib/resource-reservation-overlap";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  return { userId: parseInt(session.user.id, 10) };
}

function parseDate(value: unknown): Date | null {
  if (typeof value !== "string" || !value.trim()) return null;
  const d = new Date(value);
  return isNaN(d.getTime()) ? null : d;
}

/** GET /api/calendar/reservations/[id] */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const reservation = await prisma.resource_reservations.findUnique({
    where: { id },
    include: {
      calendar_resources: true,
      users_created: { select: { id: true, first_name: true, last_name: true, email: true } },
      users_approver: { select: { id: true, first_name: true, last_name: true } },
      users_assigned: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  if (!reservation) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  if (
    !(await canViewReservation(gate.userId, {
      created_by: reservation.created_by,
      assigned_approver_id: reservation.assigned_approver_id,
    }))
  ) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  return NextResponse.json({ reservation });
}

/** PUT /api/calendar/reservations/[id] */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.resource_reservations.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  if (
    !(await canEditReservation(gate.userId, {
      created_by: existing.created_by,
      approval_status: existing.approval_status,
    }))
  ) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const start = parseDate(body.start_date) ?? undefined;
  const end = parseDate(body.end_date) ?? undefined;

  try {
    await runInReservationTransaction((db) =>
      updateResourceReservation(db, id, {
        resourceId: body.resource_id ? parseInt(String(body.resource_id), 10) : undefined,
        userId: gate.userId,
        title: typeof body.title === "string" ? body.title.trim() : undefined,
        description: typeof body.description === "string" ? body.description : undefined,
        purpose: typeof body.purpose === "string" ? body.purpose : undefined,
        start,
        end,
      })
    );
    const reservation = await prisma.resource_reservations.findUnique({ where: { id } });
    return NextResponse.json({ reservation });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při úpravě";
    if (msg.startsWith("RESOURCE_OVERLAP:")) {
      const resourceName = msg.slice("RESOURCE_OVERLAP:".length);
      const overlap = await findResourceReservationOverlap(
        prisma,
        existing.resource_id,
        start ?? existing.start_date,
        end ?? existing.end_date,
        { excludeReservationId: id }
      );
      if (overlap) {
        return NextResponse.json(
          {
            error: formatResourceOverlapErrorCs(overlap, resourceName, (d) =>
              d.toLocaleString("cs-CZ")
            ),
          },
          { status: 409 }
        );
      }
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

/** DELETE /api/calendar/reservations/[id] */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.resource_reservations.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Rezervace nenalezena" }, { status: 404 });
  }

  if (
    !(await canDeleteReservation(gate.userId, {
      created_by: existing.created_by,
      approval_status: existing.approval_status,
      assigned_approver_id: existing.assigned_approver_id,
    }))
  ) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  await prisma.resource_reservations.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
