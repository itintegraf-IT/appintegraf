import { describe, expect, it } from "vitest";
import {
  isUserUiPrefKey,
  mergeUserUiPrefs,
  parseUserUiPrefs,
  serializeUserUiPrefs,
} from "@/lib/user-ui-prefs";

describe("user-ui-prefs", () => {
  it("parses and serializes known keys only", () => {
    const raw = JSON.stringify({
      iml_products_columns: { version: 1, visibleColumnIds: ["ig_code"] },
      bogus: true,
    });
    const parsed = parseUserUiPrefs(raw);
    expect(parsed.iml_products_columns).toEqual({
      version: 1,
      visibleColumnIds: ["ig_code"],
    });
    expect((parsed as Record<string, unknown>).bogus).toBeUndefined();
    expect(isUserUiPrefKey("iml_products_columns")).toBe(true);
    expect(isUserUiPrefKey("bogus")).toBe(false);

    const again = parseUserUiPrefs(serializeUserUiPrefs(parsed));
    expect(again).toEqual(parsed);
  });

  it("merges and removes with null", () => {
    const current = parseUserUiPrefs(
      JSON.stringify({
        iml_products_columns: { version: 1, visibleColumnIds: ["a"] },
        iml_products_column_widths: { ig_code: 100 },
      })
    );
    const merged = mergeUserUiPrefs(current, {
      iml_products_column_widths: { ig_code: 140 },
      "makety-list-visible-columns": { version: 2, visibleColumnIds: ["id"] },
      iml_products_columns: null,
    });
    expect(merged.iml_products_columns).toBeUndefined();
    expect(merged.iml_products_column_widths).toEqual({ ig_code: 140 });
    expect(merged["makety-list-visible-columns"]).toEqual({
      version: 2,
      visibleColumnIds: ["id"],
    });
  });
});
