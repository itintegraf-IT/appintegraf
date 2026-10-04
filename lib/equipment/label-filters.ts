/**
 * Filtr „Bez štítku“ — kterým položkám a místnostem ještě chybí potvrzený štítek.
 * Bez importu Prismy za běhu (jen typ), použitelné na serveru i v testech.
 */

import type { Prisma } from "@prisma/client";
import { EQUIPMENT_ITEM_STATUS } from "@/lib/equipment-status";

/** Položky s QR kódem bez potvrzeného tisku, ve skupině se štítky, nevyřazené (i bez stavu). */
export function buildLabelMissingWhere(): Prisma.equipment_itemsWhereInput {
  return {
    qr_code: { not: null },
    label_printed_at: null,
    equipment_categories: { label_required: true },
    OR: [{ status: null }, { status: { not: EQUIPMENT_ITEM_STATUS.VYRAZENO } }],
  };
}

/** Aktivní místnost bez potvrzeného štítku. */
export function roomNeedsLabel(room: { is_active: boolean; label_printed_at: string | Date | null }): boolean {
  return room.is_active && !room.label_printed_at;
}
