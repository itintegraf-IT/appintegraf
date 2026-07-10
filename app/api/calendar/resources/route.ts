import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import {
  canBookResources,
  canManageResources,
} from "@/lib/resource-reservation-access";
import { isResourceType } from "@/lib/resource-reservation-types";

async function requireSession() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  return { userId: parseInt(session.user.id, 10) };
}

/** GET /api/calendar/resources?type=room|vehicle */
export async function GET(req: NextRequest) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  if (!(await canBookResources(gate.userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const type = req.nextUrl.searchParams.get("type");
  const where: { is_active: boolean; resource_type?: string } = { is_active: true };
  if (type && isResourceType(type)) {
    where.resource_type = type;
  }

  const resources = await prisma.calendar_resources.findMany({
    where,
    orderBy: [{ sort_order: "asc" }, { name: "asc" }],
  });

  return NextResponse.json({ resources });
}

/** POST /api/calendar/resources */
export async function POST(req: NextRequest) {
  const gate = await requireSession();
  if ("error" in gate) return gate.error;

  if (!(await canManageResources(gate.userId))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const body = await req.json().catch(() => ({}));
  const resourceType = typeof body.resource_type === "string" ? body.resource_type : "";
  const name = typeof body.name === "string" ? body.name.trim() : "";

  if (!isResourceType(resourceType) || !name) {
    return NextResponse.json({ error: "Neplatný typ nebo název zdroje." }, { status: 400 });
  }

  const resource = await prisma.calendar_resources.create({
    data: {
      name,
      resource_type: resourceType,
      description: typeof body.description === "string" ? body.description.trim() || null : null,
      location: typeof body.location === "string" ? body.location.trim() || null : null,
      plate_number:
        resourceType === "vehicle" && typeof body.plate_number === "string"
          ? body.plate_number.trim() || null
          : null,
      capacity: typeof body.capacity === "number" ? body.capacity : null,
      color: typeof body.color === "string" ? body.color : "#2563EB",
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
      is_active: body.is_active !== false,
    },
  });

  return NextResponse.json({ resource }, { status: 201 });
}
