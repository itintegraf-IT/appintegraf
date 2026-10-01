import { describe, expect, it } from "vitest";
import { itemDeleteBlockReason, type ItemHistoryCounts } from "./item-history";

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
