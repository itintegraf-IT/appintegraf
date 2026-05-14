import Link from "next/link";
import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { prisma } from "@/lib/db";
import { Laptop, ArrowLeft } from "lucide-react";
import { equipmentAgeFromRecord } from "@/lib/equipment-age";
import {
  parseAssignmentDir,
  parseAssignmentSort,
  parseAssignmentView,
  sortAssignmentRows,
} from "@/lib/equipment-assignments-sort";
import { EquipmentPrirazeniClient } from "../EquipmentPrirazeniClient";

export default async function EquipmentPrirazeniPage({
  searchParams,
}: {
  searchParams: Promise<{ sort?: string; dir?: string; view?: string }>;
}) {
  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  if (!(await hasModuleAccess(userId, "equipment", "read"))) notFound();

  const seeAll =
    (await isAdmin(userId)) || (await hasModuleAccess(userId, "equipment", "write"));

  const params = await searchParams;
  const sort = parseAssignmentSort(params.sort);
  const dir = parseAssignmentDir(params.dir, sort);
  const view = parseAssignmentView(params.view, seeAll);

  const rawRows = await prisma.equipment_assignments.findMany({
    where: {
      returned_at: null,
      ...(seeAll ? {} : { user_id: userId }),
    },
    orderBy: [{ assigned_at: "desc" }],
    include: {
      users_equipment_assignments_user_idTousers: {
        select: {
          first_name: true,
          last_name: true,
          position: true,
          department_name: true,
        },
      },
      equipment_items: {
        select: {
          id: true,
          name: true,
          brand: true,
          model: true,
          serial_number: true,
          purchase_date: true,
          created_at: true,
          equipment_categories: { select: { name: true } },
        },
      },
    },
  });

  const sortedRows = seeAll ? sortAssignmentRows(rawRows, sort, dir) : rawRows;

  const rows = sortedRows.map((a) => {
    const u = a.users_equipment_assignments_user_idTousers;
    const e = a.equipment_items;
    const age = equipmentAgeFromRecord(e.purchase_date, e.created_at);
    return {
      id: a.id,
      userId: a.user_id,
      assignedAt: a.assigned_at.toISOString(),
      userName: u ? `${u.last_name} ${u.first_name}`.trim() : "—",
      userPosition: u?.position ?? null,
      userDepartment: u?.department_name ?? null,
      equipmentId: e.id,
      equipmentName: e.name,
      equipmentBrandModel: [e.brand, e.model].filter(Boolean).join(" ") || "",
      serialNumber: e.serial_number,
      categoryName: e.equipment_categories?.name ?? null,
      ageText: age.text,
      ageFromRecord: age.source === "record",
    };
  });

  return (
    <>
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="flex items-center gap-2 text-2xl font-bold text-gray-900">
            <Laptop className="h-7 w-7 text-red-600" />
            Přiřazení majetku
          </h1>
          <p className="mt-1 text-gray-600">
            {seeAll
              ? "Všechna aktivní přiřazení – tisk předávacího protokolu a protokolu o vrácení"
              : "Vaše aktivní přiřazení – tisk protokolů"}
          </p>
        </div>
        <Link
          href="/equipment?scope=all"
          className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
        >
          <ArrowLeft className="h-4 w-4" />
          Evidence vybavení
        </Link>
      </div>

      <EquipmentPrirazeniClient rows={rows} seeAll={seeAll} sort={sort} dir={dir} view={view} />
    </>
  );
}
