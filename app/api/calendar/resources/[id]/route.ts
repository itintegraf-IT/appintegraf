import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { canManageResources } from "@/lib/resource-reservation-access";
import { isResourceType } from "@/lib/resource-reservation-types";

async function requireManage() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await canManageResources(userId))) {
    return { error: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }) };
  }
  return { userId };
}

/** PUT /api/calendar/resources/[id] */
export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireManage();
  if ("error" in gate) return gate.error;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  const existing = await prisma.calendar_resources.findUnique({ where: { id } });
  if (!existing) {
    return NextResponse.json({ error: "Zdroj nenalezen" }, { status: 404 });
  }

  const body = await req.json().catch(() => ({}));
  const resourceType =
    typeof body.resource_type === "string" && isResourceType(body.resource_type)
      ? body.resource_type
      : existing.resource_type;

  const resource = await prisma.calendar_resources.update({
    where: { id },
    data: {
      name: typeof body.name === "string" ? body.name.trim() || existing.name : existing.name,
      resource_type: resourceType,
      description:
        typeof body.description === "string" ? body.description.trim() || null : existing.description,
      location:
        typeof body.location === "string" ? body.location.trim() || null : existing.location,
      plate_number:
        typeof body.plate_number === "string" ? body.plate_number.trim() || null : existing.plate_number,
      capacity: typeof body.capacity === "number" ? body.capacity : existing.capacity,
      color: typeof body.color === "string" ? body.color : existing.color,
      sort_order: typeof body.sort_order === "number" ? body.sort_order : existing.sort_order,
      is_active: typeof body.is_active === "boolean" ? body.is_active : existing.is_active,
    },
  });

  return NextResponse.json({ resource });
}

/** DELETE /api/calendar/resources/[id] – deaktivace */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireManage();
  if ("error" in gate) return gate.error;

  const id = parseInt((await params).id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Neplatné ID" }, { status: 400 });
  }

  await prisma.calendar_resources.update({
    where: { id },
    data: { is_active: false },
  });

  return NextResponse.json({ ok: true });
}
