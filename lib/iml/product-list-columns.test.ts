import { describe, expect, it } from "vitest";
import {
  DEFAULT_VISIBLE_COLUMN_IDS,
  LOCKED_COLUMN_IDS,
  resolveVisibleColumnIds,
  parseStoredColumnPrefs,
  columnPrefsFromIds,
} from "./product-list-columns";

describe("resolveVisibleColumnIds", () => {
  it("vrátí výchozí sloupce bez uložené preference", () => {
    expect(resolveVisibleColumnIds(null)).toEqual(DEFAULT_VISIBLE_COLUMN_IDS);
  });

  it("vždy zahrne zamčené sloupce", () => {
    const ids = resolveVisibleColumnIds(["sku", "die_cut_tool_code"]);
    for (const locked of LOCKED_COLUMN_IDS) {
      expect(ids).toContain(locked);
    }
  });

  it("ignoruje neznámá ID", () => {
    const ids = resolveVisibleColumnIds(["sku", "unknown_col" as never]);
    expect(ids).toContain("sku");
    expect(ids).not.toContain("unknown_col" as never);
  });
});

describe("columnPrefsFromIds", () => {
  it("serializuje verzi a ID", () => {
    const prefs = columnPrefsFromIds(["sku", "print_colors_text"]);
    expect(prefs.version).toBe(1);
    expect(prefs.visibleColumnIds).toContain("ig_code");
    expect(prefs.visibleColumnIds).toContain("sku");
  });
});

describe("parseStoredColumnPrefs", () => {
  it("parsuje pole ID", () => {
    expect(parseStoredColumnPrefs(JSON.stringify(["sku", "format"]))).toContain("sku");
  });

  it("parsuje ProductListColumnPrefs objekt", () => {
    const raw = JSON.stringify({ version: 1, visibleColumnIds: ["labels_per_sheet"] });
    expect(parseStoredColumnPrefs(raw)).toContain("labels_per_sheet");
  });
});
