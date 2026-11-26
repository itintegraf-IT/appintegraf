import { NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess } from "@/lib/auth-utils";

/** Číselníky pro formulář montáže (IML read — bez nutnosti práva Technologie). */
export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Neautorizováno" }, { status: 401 });
  }
  const userId = parseInt(session.user.id, 10);
  if (!(await hasModuleAccess(userId, "iml", "read"))) {
    return NextResponse.json({ error: "Nemáte oprávnění" }, { status: 403 });
  }

  const [dieCutDevices, sheetSizes, printMachines, shapes] = await Promise.all([
    prisma.technologie_die_cut_devices.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.technologie_sheet_sizes.findMany({
      where: { is_active: true },
      orderBy: [{ sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true },
    }),
    prisma.shared_machines.findMany({
      where: { is_active: true },
      orderBy: [{ machine_group: "asc" }, { sort_order: "asc" }, { name: "asc" }],
      select: { id: true, name: true, machine_group: true },
    }),
    prisma.iml_shape_catalog.findMany({
      orderBy: { shape_code: "asc" },
      take: 5000,
      select: { id: true, shape_code: true, shape_type: true },
    }),
  ]);

  return NextResponse.json({ dieCutDevices, sheetSizes, printMachines, shapes });
}
