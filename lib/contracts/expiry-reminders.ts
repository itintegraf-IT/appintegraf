import { prisma } from "@/lib/db";
import { ContractApprovalStatus } from "@/lib/contracts/workflow-status";
import { buildContractsWhere } from "@/lib/contracts/list-where";

const NOTIF_TYPE = "contract_expiry";
const DEDUP_DAYS = 7;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Najde smlouvy s koncem platnosti nebo expirací v horizontu (včetně dneška).
 * Použito pro cron i přehled.
 */
export async function findContractsExpiringWithinDays(days: number) {
  const start = startOfToday();
  const end = new Date(start);
  end.setDate(end.getDate() + days);

  return prisma.contracts.findMany({
    where: {
      approval_status: {
        notIn: [ContractApprovalStatus.ARCHIVED, ContractApprovalStatus.REJECTED],
      },
      OR: [
        { valid_until: { gte: start, lte: end } },
        { expires_at: { gte: start, lte: end } },
      ],
    },
    select: {
      id: true,
      title: true,
      valid_until: true,
      expires_at: true,
      created_by: true,
      responsible_user_id: true,
    },
  });
}

async function wasNotifiedRecently(
  userId: number,
  contractId: number
): Promise<boolean> {
  const since = new Date();
  since.setDate(since.getDate() - DEDUP_DAYS);

  const link = `/contracts/${contractId}`;
  const existing = await prisma.notifications.findFirst({
    where: {
      user_id: userId,
      type: NOTIF_TYPE,
      link,
      created_at: { gte: since },
    },
    select: { id: true },
  });
  return !!existing;
}

/**
 * Odešle in-app notifikace autorovi a odpovědné osobě (bez duplicit v řádu dní).
 * Volat z cronu (denně).
 */
export async function runContractExpiryReminders(horizonDays: number): Promise<{
  notified: number;
  skipped: number;
}> {
  const rows = await findContractsExpiringWithinDays(horizonDays);
  let notified = 0;
  let skipped = 0;

  for (const c of rows) {
    const end =
      c.valid_until && c.expires_at
        ? c.valid_until < c.expires_at
          ? c.valid_until
          : c.expires_at
        : c.valid_until ?? c.expires_at;
    const endLabel = end
      ? end.toLocaleDateString("cs-CZ")
      : "—";

    const userIds = new Set<number>();
    userIds.add(c.created_by);
    if (c.responsible_user_id != null) userIds.add(c.responsible_user_id);

    for (const uid of userIds) {
      if (await wasNotifiedRecently(uid, c.id)) {
        skipped += 1;
        continue;
      }
      await prisma.notifications.create({
        data: {
          user_id: uid,
          title: "Blížící se konec platnosti smlouvy",
          message: `Smlouva „${c.title}“ má platnost/expiraci k ${endLabel}.`,
          type: NOTIF_TYPE,
          link: `/contracts/${c.id}`,
        },
      });
      notified += 1;
    }
  }

  return { notified, skipped };
}

/** Počet smluv „mých“ končících do N dnů (autor nebo odpovědná osoba). */
export async function countMyContractsExpiringWithin(
  userId: number,
  days: number
): Promise<number> {
  const inner = buildContractsWhere({ expiringWithinDays: days });
  return prisma.contracts.count({
    where: {
      AND: [
        {
          OR: [
            { created_by: userId },
            { responsible_user_id: userId },
          ],
        },
        inner,
      ],
    },
  });
}
