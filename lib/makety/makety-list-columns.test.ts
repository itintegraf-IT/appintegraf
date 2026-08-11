import { describe, expect, it } from "vitest";
import {
  defaultVisibleMaketyListColumnIds,
  reorderMaketyListColumnIds,
  resolveVisibleMaketyListColumnIds,
} from "./makety-list-columns";

describe("makety-list-columns", () => {
  it("defaults include core columns and lock actions", () => {
    const ids = defaultVisibleMaketyListColumnIds(true);
    expect(ids).toContain("due_at");
    expect(ids).toContain("actions");
    expect(ids).toContain("creator");
    expect(ids).not.toContain("customer");
    expect(ids).not.toContain("label_code");
  });

  it("hides creator for non-admin defaults", () => {
    const ids = defaultVisibleMaketyListColumnIds(false);
    expect(ids).not.toContain("creator");
    expect(ids).toContain("actions");
  });

  it("keeps actions locked when resolving prefs", () => {
    const ids = resolveVisibleMaketyListColumnIds(["body", "customer"], true);
    expect(ids).toContain("actions");
    expect(ids).toContain("customer");
    expect(ids).toContain("body");
    expect(ids.at(-1)).toBe("actions");
  });

  it("drops admin-only columns for non-admin", () => {
    const ids = resolveVisibleMaketyListColumnIds(["creator", "body", "actions"], false);
    expect(ids).not.toContain("creator");
    expect(ids).toContain("body");
  });

  it("preserves custom column order from storage", () => {
    const stored = ["status", "body", "due_at", "actions"];
    const ids = resolveVisibleMaketyListColumnIds(stored, true);
    expect(ids.slice(0, 3)).toEqual(["status", "body", "due_at"]);
    expect(ids.at(-1)).toBe("actions");
  });

  it("reorders draggable columns and keeps actions last", () => {
    const base = resolveVisibleMaketyListColumnIds(
      ["due_at", "body", "status", "actions"],
      true
    );
    const next = reorderMaketyListColumnIds(base, "body", "due_at", true);
    expect(next.slice(0, 2)).toEqual(["body", "due_at"]);
    expect(next.at(-1)).toBe("actions");
  });

  it("does not move locked actions column", () => {
    const base = resolveVisibleMaketyListColumnIds(
      ["due_at", "body", "actions"],
      true
    );
    const next = reorderMaketyListColumnIds(base, "actions", "due_at", true);
    expect(next).toEqual(base);
  });
});
