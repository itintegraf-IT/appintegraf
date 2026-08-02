// In-memory sliding-window limiter. Per-isolate state — pro PM2 single-process to stačí.
// Pro multi-instance deploy přejít na Redis (upstash ratelimit).

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export type RateLimitResult = {
  ok: boolean;
  limit: number;
  remaining: number;
  resetInMs: number;
};

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
  const now = Date.now();
  const bucket = buckets.get(key);

  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { ok: true, limit, remaining: limit - 1, resetInMs: windowMs };
  }

  bucket.count += 1;
  if (bucket.count > limit) {
    return { ok: false, limit, remaining: 0, resetInMs: bucket.resetAt - now };
  }
  return { ok: true, limit, remaining: limit - bucket.count, resetInMs: bucket.resetAt - now };
}

// Periodický cleanup, aby Map nerostl donekonečna při unikátních klíčích.
// Spouští se lazy při každém 1000. checku.
let checkCounter = 0;
export function maybeCleanup(): void {
  checkCounter += 1;
  if (checkCounter < 1000) return;
  checkCounter = 0;
  const now = Date.now();
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt <= now) buckets.delete(key);
  }
}

// Pouze pro testy.
export function _resetRateLimitState(): void {
  buckets.clear();
  checkCounter = 0;
}

// Login-specific rate limiter: 5 pokusů za 15 minut.
const LOGIN_MAX_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 15 * 60 * 1000;

function loginKey(identifier: string): string {
  return `login:${identifier.toLowerCase().trim()}`;
}

export type LoginRateLimitResult = {
  ok: boolean;
  retryAfterSec: number;
};

export function checkLoginRateLimit(identifier: string): LoginRateLimitResult {
  const result = checkRateLimit(loginKey(identifier), LOGIN_MAX_ATTEMPTS, LOGIN_WINDOW_MS);
  return {
    ok: result.ok,
    retryAfterSec: Math.ceil(result.resetInMs / 1000),
  };
}

export function resetLoginRateLimit(identifier: string): void {
  buckets.delete(loginKey(identifier));
}

/** Pouze pro testy — vyčistí všechny buckety. */
export function __resetForTest(): void {
  _resetRateLimitState();
}
