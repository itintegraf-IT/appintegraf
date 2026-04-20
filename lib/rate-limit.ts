import { prisma } from "@/lib/db";

/**
 * Sliding window rate limit přes DB tabulku rate_limit_hits.
 * Jednoduchý přístup: každý kbs zarovnaný časový slot má jeden řádek s počtem zásahů.
 * Při kontrole sečteme řádky v rolujícím okně [now - windowMs, now].
 *
 * Použití (typicky v API):
 *   const { allowed, remaining } = await rateLimit({ key: `forgot:ip:${ip}`, max: 10, windowMs: 60 * 60 * 1000 });
 *   if (!allowed) return NextResponse.json({ error: "Příliš mnoho pokusů" }, { status: 429 });
 */

/** Zaokrouhlí na slot po 1 minutě, aby se řádky seskupovaly. */
function slotFor(date = new Date()): Date {
  const d = new Date(date);
  d.setSeconds(0, 0);
  return d;
}

export async function rateLimit(params: {
  key: string;
  max: number;
  windowMs: number;
}): Promise<{ allowed: boolean; remaining: number; retryAfterSeconds: number }> {
  const { key, max, windowMs } = params;
  const now = new Date();
  const from = new Date(now.getTime() - windowMs);
  const slot = slotFor(now);

  // Inkrement (nebo upsert) řádku pro aktuální slot
  try {
    await prisma.rate_limit_hits.upsert({
      where: { key_window_start: { key, window_start: slot } },
      update: { count: { increment: 1 } },
      create: { key, window_start: slot, count: 1 },
    });
  } catch {
    // V extrémním případě race condition – bezpečnostní failover: požadavek povolíme,
    // ale dál omezíme dalším voláním.
    return { allowed: true, remaining: max - 1, retryAfterSeconds: 0 };
  }

  // Součet hitů v okně
  const rows = await prisma.rate_limit_hits.findMany({
    where: { key, window_start: { gte: from } },
    select: { count: true, window_start: true },
  });
  const total = rows.reduce((sum, r) => sum + r.count, 0);
  const allowed = total <= max;
  const remaining = Math.max(0, max - total);

  // Odhadovaný retry after = do konce nejstaršího ještě započítávaného slotu + 1 minuta
  let retryAfterSeconds = 0;
  if (!allowed && rows.length > 0) {
    const oldestSlot = rows.reduce(
      (min, r) => (r.window_start < min ? r.window_start : min),
      rows[0].window_start
    );
    retryAfterSeconds = Math.max(
      60,
      Math.ceil((oldestSlot.getTime() + windowMs - now.getTime()) / 1000)
    );
  }

  return { allowed, remaining, retryAfterSeconds };
}

/**
 * Úklid staré historie (volitelně volat z cronu nebo průběžně).
 * Smaže řádky starší než 24 hodin.
 */
export async function cleanupOldRateLimitHits() {
  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000);
  await prisma.rate_limit_hits.deleteMany({
    where: { window_start: { lt: cutoff } },
  });
}
