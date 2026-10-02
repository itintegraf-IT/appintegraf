import { readFileSync } from "fs";
import path from "path";
import { describe, expect, it } from "vitest";
import { ITEM_HISTORY_RELATION_MODELS, itemDeleteBlockReason, type ItemHistoryCounts } from "./item-history";

const none: ItemHistoryCounts = {
  assignments: 0,
  locationHistory: 0,
  inventoryLines: 0,
  transfers: 0,
  files: 0,
  poolLinks: 0,
};

describe("itemDeleteBlockReason", () => {
  it("položku bez jakékoli historie dovolí smazat", () => {
    expect(itemDeleteBlockReason(none)).toBeNull();
  });

  it.each([
    ["assignments", /přiřazení\D*2/],
    ["locationHistory", /přesun\D*2/],
    ["inventoryLines", /inventur\D*2/],
    ["transfers", /převod\D*2/],
    ["files", /fot\D*2/],
    ["poolLinks", /fond\D*2/],
  ] as const)("s historií typu %s mazání zablokuje a řekne proč", (key, mentions) => {
    const reason = itemDeleteBlockReason({ ...none, [key]: 2 });
    expect(reason).not.toBeNull();
    expect(reason).toMatch(mentions);
    expect(reason).toMatch(/vyřa/i);
  });

  it("vyjmenuje všechny druhy historie, které položka má", () => {
    const reason = itemDeleteBlockReason({ ...none, assignments: 1, inventoryLines: 3 }) ?? "";
    expect(reason).toMatch(/přiřazení\D*1/);
    expect(reason).toMatch(/inventur\D*3/);
    expect(reason).not.toMatch(/přesun/);
  });
});

describe("úplnost ochrany proti mazání", () => {
  it("počítá všechny tabulky, které na položku odkazují cizím klíčem (jinak by smazání kaskádou zničilo historii)", () => {
    const schema = readFileSync(path.join(process.cwd(), "prisma/schema.prisma"), "utf8");
    const referencing: string[] = [];
    for (const [, model, body] of schema.matchAll(/^model (\w+) \{([\s\S]*?)^\}/gm)) {
      if (model === "equipment_items") continue;
      if (/^\s+\w+\s+equipment_items\??\s+@relation/m.test(body)) referencing.push(model);
    }
    expect(referencing.length).toBeGreaterThan(0);
    expect([...ITEM_HISTORY_RELATION_MODELS].sort()).toEqual(referencing.sort());
  });
});
