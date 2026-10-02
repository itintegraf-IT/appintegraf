import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { FIELD_FETCH_TIMEOUT_MS, FieldFetchTimeoutError, fieldFetch } from "./field-fetch";

/** Fetch, který nikdy neodpoví (telefon „připojený“, data neprotékají) — skončí jen zrušením. */
const hangingFetch = vi.fn(
  (_input: RequestInfo | URL, init?: RequestInit) =>
    new Promise<Response>((_resolve, reject) => {
      init?.signal?.addEventListener("abort", () => reject(new DOMException("Aborted", "AbortError")));
    })
);

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe("fieldFetch", () => {
  it("bez odpovědi do limitu požadavek zruší a ohlásí, že server neodpovídá", async () => {
    const pending = fieldFetch("/api/x", {}, FIELD_FETCH_TIMEOUT_MS, hangingFetch);
    const assertion = expect(pending).rejects.toBeInstanceOf(FieldFetchTimeoutError);
    await vi.advanceTimersByTimeAsync(FIELD_FETCH_TIMEOUT_MS);
    await assertion;
  });

  it("rychlou odpověď vrátí beze změny", async () => {
    const ok = new Response("{}", { status: 200 });
    await expect(fieldFetch("/api/x", {}, FIELD_FETCH_TIMEOUT_MS, async () => ok)).resolves.toBe(ok);
  });

  it("jiná chyba sítě není timeout", async () => {
    const offline = async () => {
      throw new TypeError("Failed to fetch");
    };
    await expect(fieldFetch("/api/x", {}, FIELD_FETCH_TIMEOUT_MS, offline)).rejects.toBeInstanceOf(TypeError);
  });
});
