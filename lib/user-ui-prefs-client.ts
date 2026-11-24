"use client";

import type { UserUiPrefKey } from "@/lib/user-ui-prefs";

/** Načte jednu UI preferenci z API (null = chybí / chyba). */
export async function loadUserUiPref(key: UserUiPrefKey): Promise<unknown | null> {
  try {
    const res = await fetch(`/api/me/ui-prefs?key=${encodeURIComponent(key)}`, {
      method: "GET",
      cache: "no-store",
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { value?: unknown };
    return data.value ?? null;
  } catch {
    return null;
  }
}

/** Uloží jednu UI preferenci na server (fire-and-forget bezpečné). */
export async function saveUserUiPref(key: UserUiPrefKey, value: unknown): Promise<boolean> {
  try {
    const res = await fetch("/api/me/ui-prefs", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key, value }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Debounced save – vhodné pro resize šířek sloupců. */
export function createDebouncedUiPrefSaver(delayMs = 400) {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let pending: { key: UserUiPrefKey; value: unknown } | null = null;

  const flush = () => {
    if (!pending) return;
    const { key, value } = pending;
    pending = null;
    void saveUserUiPref(key, value);
  };

  return {
    schedule(key: UserUiPrefKey, value: unknown) {
      pending = { key, value };
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        flush();
      }, delayMs);
    },
    flush() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      flush();
    },
    cancel() {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      pending = null;
    },
  };
}
