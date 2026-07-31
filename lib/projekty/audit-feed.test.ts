import { describe, expect, it } from "vitest";
import { buildAuditWhere, mapAuditEntry } from "./audit-feed";

describe("buildAuditWhere", () => {
  it("pokrývá přímé id karty, kompozitní klíče i id dětí", () => {
    expect(buildAuditWhere("card1", ["chk1", "note1"])).toEqual({
      OR: [
        { entityId: { in: ["card1", "chk1", "note1"] } },
        { entityId: { startsWith: "card1:" } },
      ],
    });
  });

  it("funguje bez dětí", () => {
    expect(buildAuditWhere("card1", [])).toEqual({
      OR: [
        { entityId: { in: ["card1"] } },
        { entityId: { startsWith: "card1:" } },
      ],
    });
  });
});

describe("mapAuditEntry", () => {
  const base = {
    id: "a1",
    userId: 7,
    action: "UPDATE" as const,
    entityType: "Card",
    entityId: "card1",
    diff: { title: { before: "A", after: "B" } },
    createdAt: new Date("2026-07-31T10:00:00Z"),
  };

  it("složí jméno z first_name/last_name", () => {
    const entry = mapAuditEntry({
      ...base,
      user: { id: 7, email: "j.novak@integraf.cz", first_name: "Jan", last_name: "Novák" },
    });
    expect(entry.user).toEqual({ name: "Jan Novák", email: "j.novak@integraf.cz" });
    expect(entry.action).toBe("UPDATE");
    expect(entry.entityType).toBe("Card");
  });

  it("prázdná jména degradují na null (feed pak ukáže e-mail)", () => {
    const entry = mapAuditEntry({
      ...base,
      user: { id: 7, email: "j.novak@integraf.cz", first_name: "", last_name: "" },
    });
    expect(entry.user).toEqual({ name: null, email: "j.novak@integraf.cz" });
  });

  it("smazaný uživatel (SetNull) → user null", () => {
    const entry = mapAuditEntry({ ...base, userId: null, user: null });
    expect(entry.user).toBeNull();
    expect(entry.userId).toBeNull();
  });
});
