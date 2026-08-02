import { describe, expect, it } from "vitest";
import { formatShortcut } from "./platform";

describe("formatShortcut", () => {
  it("mod+K: Ctrl+K mimo mac, ⌘K na macu", () => {
    expect(formatShortcut("mod+K", false)).toBe("Ctrl+K");
    expect(formatShortcut("mod+K", true)).toBe("⌘K");
  });

  it("mod+shift+K", () => {
    expect(formatShortcut("mod+shift+K", false)).toBe("Ctrl+Shift+K");
    expect(formatShortcut("mod+shift+K", true)).toBe("⌘⇧K");
  });

  it("case-insensitivita modifikátorů, uppercase písmen", () => {
    expect(formatShortcut("MOD+k", false)).toBe("Ctrl+K");
    expect(formatShortcut("Mod+Shift+k", true)).toBe("⌘⇧K");
  });

  it("samostatná klávesa a neznámý klíč projdou", () => {
    expect(formatShortcut("esc", false)).toBe("Esc");
    expect(formatShortcut("F1", false)).toBe("F1");
    expect(formatShortcut("?", false)).toBe("?");
  });

  it("alt/enter varianty", () => {
    expect(formatShortcut("alt+enter", false)).toBe("Alt+Enter");
    expect(formatShortcut("alt+enter", true)).toBe("⌥↵");
  });
});
