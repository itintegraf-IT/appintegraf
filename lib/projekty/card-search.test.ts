import { describe, expect, it } from "vitest";
import { buildCardSearchWhere } from "./card-search";

describe("buildCardSearchWhere", () => {
  it("ADMIN: bez board RBAC filtru; hledá v titulku i čísle karty", () => {
    const where = buildCardSearchWhere({ id: 1, role: "ADMIN" }, "faktura");
    expect(where).toEqual({
      archived: false,
      OR: [{ title: { contains: "faktura" } }, { number: { contains: "faktura" } }],
      list: { board: { archived: false } },
    });
  });

  it("dotaz ve tvaru čísla karty matchuje pole number", () => {
    const where = buildCardSearchWhere({ id: 1, role: "MEMBER" }, "T-42");
    expect(where.OR).toContainEqual({ number: { contains: "T-42" } });
  });

  it("MEMBER: RBAC OR přes owner/member na boardu", () => {
    const where = buildCardSearchWhere({ id: 7, role: "MEMBER" }, "iml");
    expect(where.list).toEqual({
      board: {
        archived: false,
        OR: [{ ownerId: 7 }, { members: { some: { userId: 7 } } }],
      },
    });
  });

  it("VIEWER dostává stejný filtr jako MEMBER (čtení dle členství)", () => {
    const where = buildCardSearchWhere({ id: 3, role: "VIEWER" }, "x");
    expect(where.list).toHaveProperty("board.OR");
  });

  it("archivované karty a boardy jsou vždy vyloučené", () => {
    const where = buildCardSearchWhere({ id: 1, role: "ADMIN" }, "q");
    expect(where.archived).toBe(false);
    // RBAC OR je vnořený v list.board — nesráží se s top-level OR pro text
    expect(where.list).toHaveProperty("board.archived", false);
  });
});
