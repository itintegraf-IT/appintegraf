import { describe, expect, it } from "vitest";
import { transferSourceLabel } from "./transfer-source";

describe("transferSourceLabel", () => {
  it.each([
    ["scan", "Sken"],
    ["manual", "Ručně"],
    ["bulk", "Hromadně"],
    ["import", "Z původní evidence"],
    ["neco", "Jiné"],
    [null, "Jiné"],
  ] as const)("%s → %s", (source, label) => {
    expect(transferSourceLabel(source)).toBe(label);
  });
});
