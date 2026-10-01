import { describe, expect, it } from "vitest";
import { summarizeInventoryLines, validateInventoryCreate } from "./inventory-rules";
import { inventoryLineLabel } from "./inventory-status";

describe("validateInventoryCreate", () => {
  it("inventura místnosti s vybranou místností", () => {
    expect(validateInventoryCreate({ name: " Kancelář DTP ", scope_type: "room", scope_id: "80" })).toEqual({
      ok: true,
      scopeType: "room",
      scopeId: 80,
      name: "Kancelář DTP",
    });
  });

  it.each([
    ["místnost nevybraná", { scope_type: "room", scope_id: "" }, /místnost/i],
    ["skupina nevybraná", { scope_type: "category" }, /skupin/i],
    ["místnost nečíselná", { scope_type: "room", scope_id: "abc" }, /místnost/i],
    ["neznámý rozsah", { scope_type: "vse" }, /rozsah/i],
    ["bez rozsahu", {}, /rozsah/i],
  ])("%s → chyba (žádná tichá celofiremní inventura)", (_label, body, message) => {
    const res = validateInventoryCreate(body);
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error).toMatch(message);
  });

  it("celofiremní inventura nepotřebuje id", () => {
    expect(validateInventoryCreate({ scope_type: "all", scope_id: "5" })).toMatchObject({
      ok: true,
      scopeType: "all",
      scopeId: null,
    });
  });

  it("bez názvu doplní výchozí, příliš dlouhý odmítne", () => {
    const res = validateInventoryCreate({ scope_type: "room", scope_id: 3 });
    expect(res.ok && res.name.length).toBeGreaterThan(0);
    expect(validateInventoryCreate({ scope_type: "room", scope_id: 3, name: "x".repeat(201) }).ok).toBe(false);
  });
});

describe("summarizeInventoryLines", () => {
  it("spočítá stavy řádků", () => {
    const lines = ["found", "found", "missing", "unexpected", "extra", "missing", "found"].map((line_status) => ({
      line_status,
    }));
    expect(summarizeInventoryLines(lines)).toEqual({ total: 7, found: 3, unexpected: 1, extra: 1, missing: 2 });
  });
});

describe("inventoryLineLabel", () => {
  it("nenaskenovaný kus během inventury čeká, po uzavření chybí", () => {
    expect(inventoryLineLabel("missing", false)).toEqual({ label: "Čeká na sken", tone: "neutral" });
    expect(inventoryLineLabel("missing", true)).toEqual({ label: "Chybí", tone: "danger" });
  });

  it("interní kódy nikdy nezobrazí syrově", () => {
    for (const status of ["found", "unexpected", "extra", "neco_neznameho"]) {
      expect(inventoryLineLabel(status, false).label).not.toBe(status);
    }
  });
});
