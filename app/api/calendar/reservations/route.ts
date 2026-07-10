import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canBookResources,
  canViewReservation,
} from "@/lib/resource-reservation-access";
import {
  createResourceReservation,
  runInReservationTransaction,
} from "@/lib/resource-reservation-create";
import {
  findResourceReservationOverlap,
  formatResourceOverlapErrorCs,
} from "@/lib/resource-reservation-overlap";
import { isResourceType } from "@/lib/resource-reservation-types";

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

/** GET /api/calendar/reservations?type=&from=&to=&day= */
export async function GET(req: NextRequest) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  if (!(await canBookResources(gate.userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");
  const from = req.nextUrl.searchParams.get("from");
  const to = req.nextUrl.searchParams.get("to");
  const pendingForMe = req.nextUrl.searchParams.get("pending_for_me") === "1";

  const where: {
    start_date?: { lte: Date };
    end_date?: { gte: Date };
    approval_status?: string;
    assigned_approver_id?: number;
    calendar_resources?: { resource_type: string };
  } = {};

  if (from && to) {
    where.start_date = { lte: new Date(`${to}T23:59:59`) };
    where.end_date = { gte: new Date(`${from}T00:00:00`) };
  }

  if (type && isResourceType(type)) {
    where.calendar_resources = { resource_type: type };
  }

  if (pendingForMe) {
    where.approval_status = "pending";
    where.assigned_approver_id = gate.userId;
  }

  const reservations = await prisma.resource_reservations.findMany({
    where,
    include: {
      calendar_resources: {
        select: { id: true, name: true, resource_type: true, color: true, location: true, plate_number: true },
      },
      users_created: { select: { id: true, first_name: true, last_name: true } },
      users_assigned: { select: { id: true, first_name: true, last_name: true } },
    },
    orderBy: { start_date: "asc" },
  });

  return NextResponse.json({ reservations });
}

/** POST /api/calendar/reservations */
export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  if (!(await canBookResources(gate.userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const resourceId = parseInt(String(body.resource_id ?? ""), 10);
  const start = parseDate(body.start_date);
  const end = parseDate(body.end_date);
  const title = typeof body.title === "string" ? body.title.trim() : "";

  if (isNaN(resourceId) || !start || !end || !title) {
    return NextResponse.json({ error: "Vyplňte zdroj, termín a název." }, { status: 400 });
  }

  try {
    const reservation = await runInReservationTransaction((db) =>
      createResourceReservation(db, {
        resourceId,
        userId: gate.userId,
        title,
        description: typeof body.description === "string" ? body.description : undefined,
        purpose: typeof body.purpose === "string" ? body.purpose : undefined,
        start,
        end,
      })
    );
    return NextResponse.json({ reservation }, { status: 201 });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Chyba při vytváření rezervace";
    if (msg.startsWith("RESOURCE_OVERLAP:")) {
      const resourceName = msg.slice("RESOURCE_OVERLAP:".length);
      const overlap = await findResourceReservationOverlap(prisma, resourceId, start, end);
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
      return NextResponse.json({ error: `${resourceName} není volné.` }, { status: 409 });
    }
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
