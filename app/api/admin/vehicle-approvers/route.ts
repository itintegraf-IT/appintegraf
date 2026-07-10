import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { isAdmin } from "@/lib/auth-utils";
import { assertUsersHaveVehicleManagerRole } from "@/lib/resource-reservation-access";

async function requireAdmin() {
  const session = await auth();
  if (!session?.user?.id) {
    return { error: NextResponse.json({ error: "Neautorizováno" }, { status: 401 }) };
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await isAdmin(userId))) {
    return { error: NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 }) };
  }
  return { userId };
}

function parseUserId(value: unknown): number | null {
  if (value === null || value === undefined || value === "") return null;
  const n = parseInt(String(value), 10);
  return isNaN(n) ? null : n;
}

/** GET /api/admin/vehicle-approvers */
export async function GET() {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const config = await prisma.resource_vehicle_approvers.findUnique({
    where: { id: 1 },
    include: {
      users_primary: { select: { id: true, first_name: true, last_name: true } },
      users_secondary: { select: { id: true, first_name: true, last_name: true } },
      users_tertiary: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ config });
}

/** PUT /api/admin/vehicle-approvers */
export async function PUT(req: NextRequest) {
  const gate = await requireAdmin();
  if ("error" in gate) return gate.error;

  const body = await req.json().catch(() => ({}));
  const primary = parseUserId(body.primary_user_id);
  const secondary = parseUserId(body.secondary_user_id);
  const tertiary = parseUserId(body.tertiary_user_id);

  if (!primary) {
    return NextResponse.json({ error: "Primární správce je povinný." }, { status: 400 });
  }

  const ids = [primary, secondary, tertiary].filter((x): x is number => x !== null);
  if (new Set(ids).size !== ids.length) {
    return NextResponse.json({ error: "Správci se nesmí opakovat." }, { status: 400 });
  }

  const valid = await assertUsersHaveVehicleManagerRole(ids);
  if (!valid) {
    return NextResponse.json(
      { error: "Všichni správci musí mít roli Správa vozidel (nebo admin)." },
      { status: 400 }
    );
  }

  const config = await prisma.resource_vehicle_approvers.upsert({
    where: { id: 1 },
    create: {
      id: 1,
      primary_user_id: primary,
      secondary_user_id: secondary,
      tertiary_user_id: tertiary,
    },
    update: {
      primary_user_id: primary,
      secondary_user_id: secondary,
      tertiary_user_id: tertiary,
    },
    include: {
      users_primary: { select: { id: true, first_name: true, last_name: true } },
      users_secondary: { select: { id: true, first_name: true, last_name: true } },
      users_tertiary: { select: { id: true, first_name: true, last_name: true } },
    },
  });

  return NextResponse.json({ config });
}
