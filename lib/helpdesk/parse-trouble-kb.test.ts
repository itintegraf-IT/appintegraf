import { describe, expect, it } from "vitest";
import { readFileSync } from "fs";
import { join } from "path";
import { parseTroubleKb } from "./parse-trouble-kb";

describe("parseTroubleKb", () => {
  it("parsuje docs/trouble.txt", () => {
    const raw = readFileSync(join(process.cwd(), "docs", "trouble.txt"), "utf8");
    const categories = parseTroubleKb(raw);

    expect(categories.length).toBeGreaterThanOrEqual(6);

    const totalEntries = categories.reduce((n, c) => n + c.entries.length, 0);
    expect(totalEntries).toBeGreaterThanOrEqual(30);

    expect(categories[0].entries.length).toBeGreaterThan(0);
    expect(categories[0].entries[0].solutionSteps.length).toBeGreaterThan(0);

    const windows = categories.find((c) => c.name.includes("WINDOWS"));
    expect(windows).toBeDefined();
    const slowPc = windows?.entries.find((e) => e.problem.includes("pomalý"));
    expect(slowPc?.tip).toBeTruthy();
    expect(slowPc?.causes).toBeTruthy();

    const security = categories.find((c) => c.name.includes("BEZPEČNOST"));
    expect(security).toBeDefined();
  });
});
