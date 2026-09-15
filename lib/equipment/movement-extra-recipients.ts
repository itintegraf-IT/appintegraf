import { prisma } from "@/lib/db";

export const EQUIPMENT_MOVEMENT_EXTRA_NOTIFY_KEY =
  "equipment_movement_extra_notify_user_ids";
const MODULE = "equipment";

function parseUserIds(raw: string | null | undefined): number[] {
  if (!raw?.trim()) return [];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    const ids = new Set<number>();
    for (const item of parsed) {
      const n = typeof item === "number" ? item : parseInt(String(item), 10);
      if (Number.isFinite(n) && n > 0) ids.add(n);
    }
    return [...ids];
  } catch {
    return [];
  }
}

export async function getExtraMovementNotifyUserIds(): Promise<number[]> {
  const row = await prisma.system_settings.findUnique({
    where: { setting_key: EQUIPMENT_MOVEMENT_EXTRA_NOTIFY_KEY },
    select: { setting_value: true },
  });
  return parseUserIds(row?.setting_value);
}

export async function setExtraMovementNotifyUserIds(
  ids: number[],
  updatedBy?: number
): Promise<number[]> {
  const unique = [
    ...new Set(
      ids
        .map((id) => (Number.isFinite(id) ? Math.trunc(id) : NaN))
        .filter((id) => id > 0)
    ),
  ];

  await prisma.system_settings.upsert({
    where: { setting_key: EQUIPMENT_MOVEMENT_EXTRA_NOTIFY_KEY },
    create: {
      setting_key: EQUIPMENT_MOVEMENT_EXTRA_NOTIFY_KEY,
      setting_value: JSON.stringify(unique),
      module: MODULE,
      description: "Dodateční příjemci notifikací pohybů majetku (ID uživatelů)",
      updated_by: updatedBy ?? null,
    },
    update: {
      setting_value: JSON.stringify(unique),
      module: MODULE,
      updated_by: updatedBy ?? null,
      updated_at: new Date(),
    },
  });

  return unique;
}
