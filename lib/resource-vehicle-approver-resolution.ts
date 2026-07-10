import type { Prisma, PrismaClient } from "@prisma/client";
import { isUserAbsentAt } from "@/lib/calendar-approver-resolution";

type Db = PrismaClient | Prisma.TransactionClient;

export type VehicleApproverTier = "primary" | "secondary" | "tertiary";

export type ResolvedVehicleApprover = {
  userId: number;
  tier: VehicleApproverTier;
  skippedTiers: VehicleApproverTier[];
};

const TIER_LABELS: Record<VehicleApproverTier, string> = {
  primary: "primární správce vozidel",
  secondary: "sekundární správce vozidel",
  tertiary: "terciární správce vozidel",
};

export function vehicleApproverTierLabel(tier: VehicleApproverTier): string {
  return TIER_LABELS[tier];
}

/**
 * Přítomnost správců se posuzuje v okamžiku žádosti (`presenceAt`), ne v termínu rezervace.
 */
export async function resolveVehicleReservationApprover(
  db: Db,
  presenceAt?: Date
): Promise<ResolvedVehicleApprover | null> {
  const at = presenceAt ?? new Date();
  const config = await db.resource_vehicle_approvers.findUnique({
    where: { id: 1 },
    select: {
      primary_user_id: true,
      secondary_user_id: true,
      tertiary_user_id: true,
    },
  });

  if (!config) return null;

  const skippedTiers: VehicleApproverTier[] = [];
  const candidates: Array<{ userId: number; tier: VehicleApproverTier }> = [
    { userId: config.primary_user_id, tier: "primary" },
  ];
  if (config.secondary_user_id) {
    candidates.push({ userId: config.secondary_user_id, tier: "secondary" });
  }
  if (config.tertiary_user_id) {
    candidates.push({ userId: config.tertiary_user_id, tier: "tertiary" });
  }

  for (const c of candidates) {
    const absent = await isUserAbsentAt(db, c.userId, at);
    if (!absent) {
      return { userId: c.userId, tier: c.tier, skippedTiers };
    }
    skippedTiers.push(c.tier);
  }

  return null;
}

export function formatVehicleApproverAssignmentNote(
  approverName: string,
  tier: VehicleApproverTier,
  skippedTiers: VehicleApproverTier[]
): string {
  const tierLabel = vehicleApproverTierLabel(tier);
  if (skippedTiers.length === 0) {
    return `Předáno ke schválení: ${approverName} (${tierLabel}).`;
  }
  const skipped = skippedTiers.map(vehicleApproverTierLabel).join(", ");
  return `Předáno ke schválení: ${approverName} (${tierLabel} – ${skipped} nepřítomen/nepřítomni).`;
}
