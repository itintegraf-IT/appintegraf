import type { PrismaTransactionClient } from "@/lib/db";
import { EQUIPMENT_UPLOAD_MODULE } from "@/lib/equipment/upload";

/** Počty záznamů, které na položku odkazují. Kaskádové smazání by je zničilo. */
export type ItemHistoryCounts = {
  assignments: number;
  locationHistory: number;
  inventoryLines: number;
  /** Legacy tabulka equipment_transfers (také maže kaskádou). */
  transfers: number;
  files: number;
  poolLinks: number;
};

const LABELS: Record<keyof ItemHistoryCounts, string> = {
  assignments: "přiřazení",
  locationHistory: "přesuny",
  inventoryLines: "řádky inventur",
  transfers: "starší převody",
  files: "fotky a přílohy",
  poolLinks: "kódy z fondu QR",
};

export async function getItemHistoryCounts(
  db: PrismaTransactionClient,
  itemId: number
): Promise<ItemHistoryCounts> {
  // Postupně, ne Promise.all: uvnitř transakce běží vše na jednom spojení.
  const assignments = await db.equipment_assignments.count({ where: { equipment_id: itemId } });
  const locationHistory = await db.equipment_location_history.count({ where: { equipment_id: itemId } });
  const inventoryLines = await db.equipment_inventory_lines.count({ where: { equipment_id: itemId } });
  const transfers = await db.equipment_transfers.count({ where: { equipment_id: itemId } });
  const files = await db.file_uploads.count({
    where: { module: EQUIPMENT_UPLOAD_MODULE, record_id: itemId },
  });
  const poolLinks = await db.equipment_qr_pool.count({ where: { equipment_id: itemId } });
  return { assignments, locationHistory, inventoryLines, transfers, files, poolLinks };
}

/** `null` = položku lze smazat (nemá žádnou historii), jinak důvod pro uživatele. */
export function itemDeleteBlockReason(counts: ItemHistoryCounts): string | null {
  const parts = (Object.keys(LABELS) as (keyof ItemHistoryCounts)[])
    .filter((key) => counts[key] > 0)
    .map((key) => `${LABELS[key]}: ${counts[key]}`);
  if (parts.length === 0) return null;
  return (
    `Položka má historii (${parts.join(", ")}). Smazat lze jen omylem založenou položku bez historie — ` +
    "jinak ji vyřaďte (Upravit → stav Vyřazeno, datum a důvod)."
  );
}
