import type { Prisma } from "@prisma/client";

/**
 * Generuje sekvenční číslo dealu OP-YY-NNN (3 číslice padded, přesahuje na 4 po 999).
 * Race-safe: spoléhá na @unique constraint v DB. Volající retry při P2002.
 */
export async function generateDealNumber(
  tx: Prisma.TransactionClient,
): Promise<string> {
  const yy = String(new Date().getFullYear() % 100).padStart(2, "0");
  const prefix = `OP-${yy}-`;

  const last = await tx.crm_deals.findFirst({
    where: { number: { startsWith: prefix } },
    orderBy: { number: "desc" },
    select: { number: true },
  });

  const next = last?.number
    ? Number(last.number.slice(prefix.length)) + 1
    : 1;

  return `${prefix}${String(next).padStart(3, "0")}`;
}
