import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { hasModuleAccess, isAdmin } from "@/lib/auth-utils";
import { ArrowLeft } from "lucide-react";
import { EquipmentAssignClient } from "./EquipmentAssignClient";

export default async function EquipmentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;
  const admin = await isAdmin(userId);
  const equipmentWrite = await hasModuleAccess(userId, "equipment", "write");

  const item = await prisma.equipment_items.findUnique({
    where: { id },
    include: {
      equipment_categories: true,
      equipment_assignments: {
        where: { returned_at: null },
        take: 1,
        include: {
          users_equipment_assignments_user_idTousers: {
            select: { first_name: true, last_name: true },
          },
        },
      },
    },
  });

  if (!item) notFound();

  const activeAssignment = item.equipment_assignments[0];
  const assignedTo = activeAssignment?.users_equipment_assignments_user_idTousers
    ? {
        first_name: activeAssignment.users_equipment_assignments_user_idTousers.first_name,
        last_name: activeAssignment.users_equipment_assignments_user_idTousers.last_name,
      }
    : null;
  const isAssignedToMe = activeAssignment?.user_id === userId;
  const canAssign = (admin || equipmentWrite) && item.status !== "vy_azeno";
  const canReturn =
    (admin || equipmentWrite || isAssignedToMe) && !!activeAssignment;

  return (
    <>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
          <p className="mt-1 text-gray-600">Detail vybavení</p>
        </div>
        <div className="flex gap-2">
          {admin && (
            <Link
              href={`/equipment/${item.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          )}
          <Link
            href="/equipment"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-sm text-gray-500">Značka</p>
            <p className="font-medium">{item.brand ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Model</p>
            <p className="font-medium">{item.model ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Sériové číslo</p>
            <p className="font-mono">{item.serial_number ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Kategorie</p>
            <p className="font-medium">{item.equipment_categories?.name ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Status</p>
            <p className="font-medium">{item.status ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Datum nákupu</p>
            <p>{item.purchase_date ? new Date(item.purchase_date).toLocaleDateString("cs-CZ") : "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Dodavatel</p>
            <p>{item.supplier ?? "-"}</p>
          </div>
          <div>
            <p className="text-sm text-gray-500">Číslo faktury</p>
            <p>{item.invoice_number ?? "-"}</p>
          </div>
          {item.description && (
            <div className="sm:col-span-2">
              <p className="text-sm text-gray-500">Popis</p>
              <p>{item.description}</p>
            </div>
          )}
        </div>
      </div>

      <EquipmentAssignClient
        equipmentId={item.id}
        status={item.status}
        canAssign={canAssign && !activeAssignment}
        canReturn={canReturn}
        assignedTo={assignedTo}
        assignedAt={activeAssignment?.assigned_at ? activeAssignment.assigned_at.toISOString() : null}
      />
    </>
  );
}
