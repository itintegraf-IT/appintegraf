"use client";

import { useRouter } from "next/navigation";
import Link from "next/link";
import { Eye, Pencil, UserPlus, Trash2 } from "lucide-react";

type Props = {
  equipmentId: number;
  canEdit: boolean;
  canAssign: boolean;
  canDelete: boolean;
};

export function EquipmentTableActions({
  equipmentId,
  canEdit,
  canAssign,
  canDelete,
}: Props) {
  const router = useRouter();

  const handleDelete = async () => {
    if (!confirm("Opravdu chcete smazat toto vybavení? Tato akce je nevratná.")) return;
    try {
      const res = await fetch(`/api/equipment/${equipmentId}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert(data.error ?? "Chyba při mazání");
        return;
      }
      router.refresh();
    } catch {
      alert("Chyba při mazání");
    }
  };

  return (
    <div className="flex items-center justify-end gap-1">
      <Link
        href={`/equipment/${equipmentId}`}
        className="rounded p-2 text-gray-600 hover:bg-gray-100"
        title="Detail"
      >
        <Eye className="h-4 w-4" />
      </Link>
      {canEdit && (
        <Link
          href={`/equipment/${equipmentId}/edit`}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          title="Upravit"
        >
          <Pencil className="h-4 w-4" />
        </Link>
      )}
      {canAssign && (
        <Link
          href={`/equipment/${equipmentId}`}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          title="Přiřadit"
        >
          <UserPlus className="h-4 w-4" />
        </Link>
      )}
      {canDelete && (
        <button
          type="button"
          onClick={handleDelete}
          className="rounded p-2 text-red-600 hover:bg-red-50"
          title="Smazat"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}
