"use client";

import Link from "next/link";
import { Eye, Pencil, UserPlus, Printer, FileText, QrCode } from "lucide-react";

type Props = {
  equipmentId: number;
  /** Aktivní přiřazení – tisk protokolů */
  assignmentId?: number | null;
  canEdit: boolean;
  canAssign: boolean;
  /** Otevře dialog tisku štítku; bez něj vede ikona přímo na PDF (pozice 1). */
  onPrintLabel?: () => void;
};

export function EquipmentTableActions({
  equipmentId,
  assignmentId = null,
  canEdit,
  canAssign,
  onPrintLabel,
}: Props) {
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
          title="Přiřadit držiteli"
        >
          <UserPlus className="h-4 w-4" />
        </Link>
      )}
      {onPrintLabel ? (
        <button
          type="button"
          onClick={onPrintLabel}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          title="Tisk štítku"
          aria-label="Tisk štítku"
        >
          <QrCode className="h-4 w-4" />
        </button>
      ) : (
        <a
          href={`/api/equipment/${equipmentId}/label`}
          className="rounded p-2 text-gray-600 hover:bg-gray-100"
          title="Tisk štítku"
        >
          <QrCode className="h-4 w-4" />
        </a>
      )}
      {assignmentId != null && (
        <>
          <Link
            href={`/equipment/protokol/predani?assignmentId=${assignmentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-2 text-gray-600 hover:bg-gray-100"
            title="Předávací protokol"
          >
            <Printer className="h-4 w-4" />
          </Link>
          <Link
            href={`/equipment/protokol/vraceni?assignmentId=${assignmentId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded p-2 text-gray-600 hover:bg-gray-100"
            title="Protokol o vrácení"
          >
            <FileText className="h-4 w-4" />
          </Link>
        </>
      )}
    </div>
  );
}
