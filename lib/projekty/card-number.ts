import { Prisma, type PrismaClient } from "@prisma/client";
import { prisma } from "@/lib/projekty/prisma";

const NUMBER_PREFIX = "CARD";

type DbClient = PrismaClient | Prisma.TransactionClient;

/**
 * Generate next Card.number ve formátu CARD-{YY}-{4-digit-sequence}.
 * Sequence per rok. Poskytni `tx` parameter pro atomicitu — jinak vzniká
 * race window mezi findFirst a follow-up create (paralelní requesty mohou
 * vygenerovat stejné číslo a UNIQUE constraint na Card.number 1 z nich
 * shodí na P2002).
 *
 * Použij v rámci createCard transakce:
 * ```typescript
 * await prisma.$transaction(async (tx) => {
 *   const number = await generateCardNumber(new Date(), tx);
 *   return tx.card.create({ data: { number, ... } });
 * });
 * ```
 */
export async function generateCardNumber(
  now: Date = new Date(),
  client: DbClient = prisma,
): Promise<string> {
  const year = now.getFullYear() % 100;
  const yearPrefix = `${NUMBER_PREFIX}-${String(year).padStart(2, "0")}-`;

  // Sekvence je monotónní podle času vytvoření, takže poslední vytvořená karta roku
  // má nejvyšší pořadí. Řadíme podle createdAt (NE lexikograficky podle `number` —
  // to se rozbije po 9999, kdy '9999' > '10000' jako string → duplicitní číslo).
  const last = await client.card.findFirst({
    where: { number: { startsWith: yearPrefix } },
    orderBy: { createdAt: "desc" },
    select: { number: true },
  });

  const lastSeq = last
    ? parseInt(last.number.slice(yearPrefix.length), 10)
    : 0;
  const nextSeq = lastSeq + 1;

  return `${yearPrefix}${String(nextSeq).padStart(4, "0")}`;
}
