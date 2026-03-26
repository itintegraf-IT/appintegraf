/**
 * Hodnoty sloupce equipment_items.status v DB (shodné s MySQL ENUM).
 * Prisma enum s @map u tohoto sloupce nefunguje spolehlivě s MariaDB driverem (P2023).
 */
export const EQUIPMENT_ITEM_STATUS = {
  SKLADEM: "skladem",
  PRIRAZENO: "přiřazeno",
  SERVIS: "servis",
  VYRAZENO: "vyřazeno",
} as const;

export type EquipmentItemStatus =
  (typeof EQUIPMENT_ITEM_STATUS)[keyof typeof EQUIPMENT_ITEM_STATUS];

export const EQUIPMENT_ITEM_STATUS_LIST: EquipmentItemStatus[] = Object.values(
  EQUIPMENT_ITEM_STATUS,
);

export function isEquipmentItemStatus(s: string): s is EquipmentItemStatus {
  return (EQUIPMENT_ITEM_STATUS_LIST as readonly string[]).includes(s);
}
