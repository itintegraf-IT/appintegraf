import { describe, expect, it } from "vitest";
import { buildCardSearchWhere } from "./card-search";

describe("buildCardSearchWhere", () => {
  it("ADMIN: bez OR filtru, ale archived a contains zůstávají", () => {
    const where = buildCardSearchWhere({ id: 1, role: "ADMIN" }, "faktura");
    expect(where).toEqual({
      archived: false,
      title: { contains: "faktura" },
      list: { board: { archived: false } },
    });
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
    expect(where.list).toHaveProperty("board.archived", false);
  });
});
