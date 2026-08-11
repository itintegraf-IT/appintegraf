import { describe, expect, it } from "vitest";
import {
  defaultVisibleMaketyListColumnIds,
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
  });

  it("drops admin-only columns for non-admin", () => {
    const ids = resolveVisibleMaketyListColumnIds(["creator", "body", "actions"], false);
    expect(ids).not.toContain("creator");
    expect(ids).toContain("body");
  });
});
