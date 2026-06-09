import { AppError } from "@/lib/crm/errors";
import { logger } from "@/lib/crm/logger";
import { getAccessToken, invalidateGraphToken } from "./token";

const DEFAULT_RETRY_AFTER_MS = 60_000;

export class GraphRateLimitError extends Error {
  public readonly retryAfterMs: number;

  constructor(retryAfterMs: number) {
    super(`Graph rate-limited, retry za ${retryAfterMs} ms.`);
    this.name = "GraphRateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

function parseRetryAfter(resp: Response): number {
  const raw = resp.headers?.get?.("Retry-After");
  if (!raw) return DEFAULT_RETRY_AFTER_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds <= 0) return DEFAULT_RETRY_AFTER_MS;
  return seconds * 1000;
}

async function safeText(resp: Response): Promise<string> {
  try {
    return await resp.text();
  } catch {
    return "";
  }
}

async function doFetch(userId: number, url: string, init: RequestInit | undefined): Promise<Response> {
  const token = await getAccessToken(userId);
  const callerHeaders = (init?.headers as Record<string, string> | undefined) ?? {};
  return fetch(url, {
    ...init,
    headers: {
      ...callerHeaders,
      Authorization: `Bearer ${token}`,
      Accept: "application/json",
    },
  });
}

export async function graphFetch<T>(userId: number, url: string, init?: RequestInit): Promise<T> {
  let resp = await doFetch(userId, url, init);

  if (resp.status === 401) {
    logger.warn("[crm-graph/client] 401, invaliduji token", { userId, url });
    await invalidateGraphToken(userId);
    resp = await doFetch(userId, url, init);
  }

  if (resp.ok) {
    return (await resp.json()) as T;
  }

  if (resp.status === 429) {
    const retryAfterMs = parseRetryAfter(resp);
    throw new GraphRateLimitError(retryAfterMs);
  }

  const body = await safeText(resp);
  logger.error("[crm-graph/client] Graph API chyba", {
    userId,
    url,
    status: resp.status,
    body: body.slice(0, 200),
  });
  throw new AppError("INTERNAL", `Graph ${resp.status}: ${body.slice(0, 200)}`);
}
