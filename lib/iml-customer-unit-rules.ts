import { prisma } from "@/lib/db";
import { isImlUnitType, type ImlUnitType } from "@/lib/iml-customer-units";

export async function assertValidUnitAssignment(opts: {
  unitType: string;
  parentId: number | null;
  customerId?: number;
}): Promise<{ ok: true; unitType: ImlUnitType; parentId: number | null } | { ok: false; error: string }> {
  const unitTypeRaw = String(opts.unitType ?? "standalone").trim();
  if (!isImlUnitType(unitTypeRaw)) {
    return { ok: false, error: "Neplatný typ jednotky" };
  }
  const unitType = unitTypeRaw;
  const parentId = opts.parentId;

  if (unitType === "branch" && parentId == null) {
    return { ok: false, error: "Pobočka musí mít přiřazenou centrálu" };
  }
  if (unitType !== "branch" && parentId != null) {
    return { ok: false, error: "Parent lze nastavit pouze u pobočky" };
  }

  if (parentId != null) {
    const parent = await prisma.iml_customers.findUnique({
      where: { id: parentId },
      select: { id: true, unit_type: true, parent_id: true },
    });
    if (!parent) {
      return { ok: false, error: "Centrála (parent) nenalezena" };
    }
    if (parent.unit_type !== "headquarters" || parent.parent_id != null) {
      return { ok: false, error: "Parent musí být centrála skupiny" };
    }
    if (opts.customerId != null && parentId === opts.customerId) {
      return { ok: false, error: "Jednotka nemůže být parent sama sobě" };
    }
  }

  if (opts.customerId != null && unitType === "headquarters") {
    const selfAsBranch = await prisma.iml_customers.findFirst({
      where: { parent_id: opts.customerId },
      select: { id: true },
    });
    if (selfAsBranch && parentId != null) {
      return { ok: false, error: "Centrála nemůže být zároveň pobočkou" };
    }
  }

  return { ok: true, unitType, parentId };
}
