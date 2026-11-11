import type { Prisma, PrismaClient } from "@prisma/client";
import {
  getCurrentAbsenceEnd,
  isUserAbsentAt,
  shouldKeepAbsentApprover,
} from "@/lib/calendar-approver-resolution";

type Db = PrismaClient | Prisma.TransactionClient;

export type VehicleApproverTier = "primary" | "secondary" | "tertiary";

export type ResolvedVehicleApprover = {
  userId: number;
  tier: VehicleApproverTier;
  skippedTiers: VehicleApproverTier[];
  /** Správce je teď nepřítomen, ale stihne se vrátit včas – přiřazen a čeká se. */
  waitingForReturn?: boolean;
};

const TIER_LABELS: Record<VehicleApproverTier, string> = {
  primary: "primární správce vozidel",
  secondary: "sekundární správce vozidel",
  tertiary: "terciární správce vozidel",
};

export function vehicleApproverTierLabel(tier: VehicleApproverTier): string {
  return TIER_LABELS[tier];
}

export type ResolveVehicleReservationApproverOptions = {
  /** Okamžik kontroly přítomnosti; výchozí = teď. */
  presenceAt?: Date;
  /** Začátek rezervace – pro rozhodnutí „počkat na návrat“. */
  reservationStart: Date;
};

/**
 * Přítomnost správců se posuzuje v okamžiku žádosti (`presenceAt`).
 * Nepřítomný se nepřeskakuje, pokud se vrátí ≥ 3 pracovní dny před `reservationStart`.
 */
export async function resolveVehicleReservationApprover(
  db: Db,
  options: ResolveVehicleReservationApproverOptions
): Promise<ResolvedVehicleApprover | null> {
  const at = options.presenceAt ?? new Date();
  const reservationStart = options.reservationStart;
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

    const returnAt = await getCurrentAbsenceEnd(db, c.userId, at);
    if (returnAt && shouldKeepAbsentApprover(returnAt, reservationStart)) {
      return {
        userId: c.userId,
        tier: c.tier,
        skippedTiers,
        waitingForReturn: true,
      };
    }

    skippedTiers.push(c.tier);
  }

  return null;
}

export function formatVehicleApproverAssignmentNote(
  approverName: string,
  tier: VehicleApproverTier,
  skippedTiers: VehicleApproverTier[],
  waitingForReturn?: boolean
): string {
  const tierLabel = vehicleApproverTierLabel(tier);
  const waitSuffix = waitingForReturn
    ? " – nepřítomen, návrat včas, čeká se na schválení"
    : "";
  if (skippedTiers.length === 0) {
    return `Předáno ke schválení: ${approverName} (${tierLabel}${waitSuffix}).`;
  }
  const skipped = skippedTiers.map(vehicleApproverTierLabel).join(", ");
  return `Předáno ke schválení: ${approverName} (${tierLabel}${waitSuffix} – ${skipped} nepřítomen/nepřítomni).`;
}
