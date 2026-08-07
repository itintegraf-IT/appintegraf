import { notFound } from "next/navigation";
import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/db";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";
import { equipmentAgeFromRecord } from "@/lib/equipment-age";
import { ArrowLeft } from "lucide-react";
import { EquipmentAssignClient } from "./EquipmentAssignClient";
import { EquipmentPhotoGallery } from "../_components/EquipmentPhotoGallery";
import { EquipmentDocumentsPanel } from "../_components/EquipmentDocumentsPanel";
import { EquipmentTransferModal } from "../_components/EquipmentTransferModal";
import { EquipmentCodeBadge } from "../_components/EquipmentCodeBadge";
import { formatEquipmentPrice } from "@/lib/equipment/format-price";
import { canReadEquipment, canWriteEquipment } from "@/lib/equipment/access";

function fmtPrice(p: unknown): string {
  return formatEquipmentPrice(p);
}

export default async function EquipmentViewPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const id = parseInt((await params).id, 10);
  if (isNaN(id)) notFound();

  const session = await auth();
  const userId = session?.user?.id ? parseInt(session.user.id, 10) : 0;

  const item = await prisma.equipment_items.findUnique({
    where: { id },
    include: {
      equipment_categories: {
        include: {
          users_responsible: { select: { first_name: true, last_name: true } },
        },
      },
      equipment_rooms: true,
      location_history: {
        orderBy: { transferred_at: "desc" },
        take: 20,
        include: {
          room_from: { select: { code: true, name: true } },
          room_to: { select: { code: true, name: true } },
          users: { select: { first_name: true, last_name: true } },
        },
      },
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
  if (!(await canReadEquipment(userId, item.category_id))) notFound();

  const canWrite = await canWriteEquipment(userId, item.category_id);
  const rooms = await prisma.equipment_rooms.findMany({
    where: { is_active: true },
    orderBy: { code: "asc" },
    select: { id: true, name: true, code: true },
  });

  const activeAssignment = item.equipment_assignments[0];
  const assignedTo = activeAssignment?.users_equipment_assignments_user_idTousers
    ? {
        first_name: activeAssignment.users_equipment_assignments_user_idTousers.first_name,
        last_name: activeAssignment.users_equipment_assignments_user_idTousers.last_name,
      }
    : null;
  const canAssign = canWrite && item.status !== EQUIPMENT_ITEM_STATUS.VYRAZENO;
  const canReturn = canWrite && !!activeAssignment;
  const age = equipmentAgeFromRecord(item.purchase_date, item.created_at);

  return (
    <div className="space-y-6">
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{item.name}</h1>
          <p className="mt-1 text-gray-600">
            {item.asset_tag ?? "Bez inventárního čísla"} · {item.status}
            {item.purchase_price != null ? ` · ${fmtPrice(item.purchase_price)}` : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {canWrite ? (
            <Link
              href={`/equipment/${item.id}/edit`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Upravit
            </Link>
          ) : null}
          {item.qr_code ? (
            <a
              href={`/api/equipment/${item.id}/label`}
              className="rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
            >
              Tisk štítku
            </a>
          ) : null}
          {canWrite && item.status !== EQUIPMENT_ITEM_STATUS.VYRAZENO ? (
            <EquipmentTransferModal
              equipmentId={item.id}
              rooms={rooms}
              currentRoomId={item.room_id}
            />
          ) : null}
          <Link
            href="/equipment"
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50"
          >
            <ArrowLeft className="h-4 w-4" />
            Zpět
          </Link>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold">Přehled</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Značka / model</p>
                <p className="font-medium">
                  {[item.brand, item.model].filter(Boolean).join(" ") || "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Sériové číslo</p>
                <p className="font-mono">{item.serial_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Inventární č. / QR</p>
                <p className="font-mono text-sm">
                  {item.asset_tag ?? "—"} / {item.qr_code ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Skupina</p>
                <p className="font-medium">{item.equipment_categories?.name ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Místnost</p>
                <p className="font-medium">
                  {item.equipment_rooms
                    ? `${item.equipment_rooms.code} – ${item.equipment_rooms.name}`
                    : item.location ?? "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Status</p>
                <p className="font-medium">{item.status ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pořizovací cena</p>
                <p className="text-lg font-semibold text-gray-900">{fmtPrice(item.purchase_price)}</p>
              </div>
            </div>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold">Nákup a hodnota</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-sm text-gray-500">Datum nákupu</p>
                <p>
                  {item.purchase_date
                    ? new Date(item.purchase_date).toLocaleDateString("cs-CZ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Pořizovací cena</p>
                <p className="font-medium">{fmtPrice(item.purchase_price)}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Dodavatel</p>
                <p>{item.supplier ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Číslo faktury</p>
                <p>{item.invoice_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Záruka do</p>
                <p>
                  {item.warranty_until
                    ? new Date(item.warranty_until).toLocaleDateString("cs-CZ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Poslední servis</p>
                <p>
                  {item.last_service_at
                    ? new Date(item.last_service_at).toLocaleDateString("cs-CZ")
                    : "—"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500">Stáří</p>
                <p className="font-medium">{age.text}</p>
              </div>
            </div>
          </div>

          {(item.description || item.notes || item.disposal_reason) && (
            <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm space-y-3">
              <h2 className="font-semibold">Poznámky a vyřazení</h2>
              {item.description ? (
                <div>
                  <p className="text-sm text-gray-500">Popis</p>
                  <p>{item.description}</p>
                </div>
              ) : null}
              {item.notes ? (
                <div>
                  <p className="text-sm text-gray-500">Poznámky</p>
                  <p>{item.notes}</p>
                </div>
              ) : null}
              {item.disposed_at ? (
                <div>
                  <p className="text-sm text-gray-500">Vyřazeno</p>
                  <p>
                    {new Date(item.disposed_at).toLocaleDateString("cs-CZ")}
                    {item.disposal_reason ? ` – ${item.disposal_reason}` : ""}
                  </p>
                </div>
              ) : null}
            </div>
          )}

          <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
            <h2 className="mb-3 font-semibold">Historie přesunů</h2>
            {item.location_history.length === 0 ? (
              <p className="text-sm text-gray-500">Zatím bez přesunů.</p>
            ) : (
              <ul className="space-y-2 text-sm">
                {item.location_history.map((h) => (
                  <li key={h.id} className="flex flex-wrap justify-between gap-2 border-b pb-2">
                    <span>
                      {h.room_from
                        ? `${h.room_from.code}`
                        : "—"}{" "}
                      → {h.room_to.code} – {h.room_to.name}
                      <span className="text-gray-500">
                        {" "}
                        ({h.users.last_name} {h.users.first_name}, {h.source})
                      </span>
                    </span>
                    <a
                      href={`/equipment/protokol/presun-mistnosti?historyId=${h.id}`}
                      className="text-red-700 hover:underline"
                    >
                      Protokol
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <EquipmentPhotoGallery equipmentId={item.id} canWrite={canWrite} />
          <EquipmentDocumentsPanel equipmentId={item.id} canWrite={canWrite} />
        </div>

        <div className="space-y-4">
          {item.asset_tag || item.qr_code ? (
            <EquipmentCodeBadge
              primaryLabel="Inventární č."
              primaryCode={item.asset_tag ?? item.qr_code!}
              secondaryCode={
                item.asset_tag && item.qr_code && item.asset_tag !== item.qr_code
                  ? item.qr_code
                  : null
              }
              qrSrc={
                item.qr_code
                  ? `/api/equipment/qr?code=${encodeURIComponent(item.qr_code)}`
                  : null
              }
            />
          ) : null}
          {item.equipment_categories.users_responsible ? (
            <div className="rounded-xl border bg-white p-4 text-sm shadow-sm">
              <p className="text-gray-500">Zodpovědný za skupinu</p>
              <p className="font-medium">
                {item.equipment_categories.users_responsible.last_name}{" "}
                {item.equipment_categories.users_responsible.first_name}
              </p>
            </div>
          ) : null}
        </div>
      </div>

      <EquipmentAssignClient
        equipmentId={item.id}
        assignmentId={activeAssignment?.id ?? null}
        status={item.status}
        canAssign={canAssign && !activeAssignment}
        canReturn={canReturn}
        assignedTo={assignedTo}
        assignedAt={activeAssignment?.assigned_at ? activeAssignment.assigned_at.toISOString() : null}
      />
    </div>
  );
}
