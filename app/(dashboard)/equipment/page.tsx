import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import Link from "next/link";
import { Laptop, Plus, ClipboardList, UserCheck } from "lucide-react";
import { EquipmentRequestsTab } from "./EquipmentRequestsTab";
import { EquipmentTableActions } from "./EquipmentTableActions";

export default async function EquipmentPage({
  searchParams,
}: {
  searchParams: Promise<{ scope?: string; tab?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const admin = await isAdmin(userId);
  const equipmentRead = await hasModuleAccess(userId, "equipment", "read");
  const equipmentWrite = await hasModuleAccess(userId, "equipment", "write");
  const params = await searchParams;
  const scope = params.scope ?? "mine";
  const tab = params.tab ?? "equipment";

  type EquipmentRow = {
    id: number;
    name: string;
    brand: string | null;
    model: string | null;
    serial_number: string | null;
    status: string | null;
    purchase_date: Date | null;
    equipment_categories?: { name: string };
    assignment_id?: number | null;
  };
  let equipment: EquipmentRow[] = [];

  if (admin && scope === "all") {
    const rows = await prisma.equipment_items.findMany({
      take: 200,
      orderBy: { id: "desc" },
      include: {
        equipment_categories: { select: { name: true } },
        equipment_assignments: {
          where: { returned_at: null },
          take: 1,
          select: { id: true },
        },
      },
    });
    equipment = rows.map((r) => {
      const a = r.equipment_assignments[0];
      const { equipment_assignments: _, ...item } = r;
      return {
        ...item,
        assignment_id: a?.id ?? null,
      };
    });
  } else {
    const assignments = await prisma.equipment_assignments.findMany({
      where: { user_id: userId, returned_at: null },
      include: {
        equipment_items: {
          include: { equipment_categories: { select: { name: true } } },
        },
      },
      orderBy: { assigned_at: "desc" },
    });
    equipment = assignments.map((a) => ({
      ...a.equipment_items,
      assignment_id: a.id,
    }));
  }

  const formatDate = (d: Date | null) =>
    d ? new Date(d).toLocaleDateString("cs-CZ") : "-";

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Laptop className="h-7 w-7 text-red-600" />
            Majetek
          </h1>
          <p className="mt-1 text-gray-600">
            {tab === "requests" ? "Požadavky na techniku" : "Evidence vybavení"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {equipmentRead && (
            <div className="flex rounded-lg border border-gray-200 bg-gray-50 p-1">
              <Link
                href={tab === "requests" ? "/equipment" : "/equipment?tab=requests"}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "requests"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <ClipboardList className="h-4 w-4" />
                Požadavky
              </Link>
              <Link
                href={tab === "equipment" ? "/equipment" : "/equipment"}
                className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                  tab === "equipment"
                    ? "bg-white text-gray-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                <Laptop className="h-4 w-4" />
                Vybavení
              </Link>
              <Link
                href="/equipment/prirazeni"
                className="flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium text-gray-600 transition-colors hover:text-gray-900"
              >
                <UserCheck className="h-4 w-4" />
                Přiřazení
              </Link>
            </div>
          )}
          {admin && tab === "equipment" && (
            <>
              <Link
                href={scope === "all" ? "/equipment" : "/equipment?scope=all"}
                className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
              >
                {scope === "all" ? "Moje vybavení" : "Všechno vybavení"}
              </Link>
              <Link
                href="/equipment/add"
                className="inline-flex items-center gap-2 rounded-lg bg-red-600 px-4 py-2 font-medium text-white hover:bg-red-700"
              >
                <Plus className="h-4 w-4" />
                Přidat vybavení
              </Link>
            </>
          )}
        </div>
      </div>

      {tab === "requests" ? (
        <EquipmentRequestsTab />
      ) : (
      <div className="rounded-xl border border-gray-200 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="border-b border-gray-200 bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Název</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Značka / Model</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Sériové č.</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Kategorie</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Status</th>
                <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">Nákup</th>
                <th className="px-4 py-3 text-right text-sm font-semibold text-gray-700">Akce</th>
              </tr>
            </thead>
            <tbody>
              {equipment.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                    Žádné vybavení
                  </td>
                </tr>
              ) : (
                (equipment as EquipmentRow[]).map((e) => (
                  <tr key={e.id} className="border-b border-gray-100 hover:bg-gray-50">
                    <td className="px-4 py-3 font-medium text-gray-900">{e.name}</td>
                    <td className="px-4 py-3">
                      {[e.brand, e.model].filter(Boolean).join(" / ") || "-"}
                    </td>
                    <td className="px-4 py-3 font-mono text-sm">{e.serial_number ?? "-"}</td>
                    <td className="px-4 py-3">{e.equipment_categories?.name ?? "-"}</td>
                    <td className="px-4 py-3">
                      <span className="rounded bg-gray-100 px-2 py-0.5 text-sm">{e.status ?? "-"}</span>
                    </td>
                    <td className="px-4 py-3">{formatDate(e.purchase_date)}</td>
                    <td className="px-4 py-3">
                      <EquipmentTableActions
                        equipmentId={e.id}
                        assignmentId={e.assignment_id ?? null}
                        canEdit={admin}
                        canAssign={(admin || equipmentWrite) && scope === "all"}
                        canDelete={admin}
                      />
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
      )}
    </>
  );
}
