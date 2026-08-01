import { describe, expect, it } from "vitest";
import { buildGroups } from "./list-grouping";
import { parseBoardGroup } from "./board-view";
import type { CardData } from "@/components/projekty/boards/CardItem";
import type { ListData } from "@/components/projekty/boards/BoardListColumn";

function card(id: string, overrides: Partial<CardData> = {}): CardData {
  return {
    id,
    number: `T-${id}`,
    listId: "l1",
    boardId: "b1",
    title: `Karta ${id}`,
    description: null,
    position: 1,
    dueDate: null,
    startDate: null,
    completed: false,
    cover: null,
    archived: false,
    members: [],
    labels: [],
    ...overrides,
  };
}

function member(userId: number, name: string) {
  return {
    userId,
    user: { id: userId, email: `${name}@x.cz`, name, image: null },
  };
}

function daysFromToday(days: number): string {
  const now = new Date();
  return new Date(now.getFullYear(), now.getMonth(), now.getDate() + days, 12).toISOString();
}

const lists: ListData[] = [
  {
    id: "l1",
    boardId: "b1",
    name: "To Do",
    color: "info",
    position: 1,
    archived: false,
    cards: [
      card("a", { dueDate: daysFromToday(-1) }),
      card("b", { dueDate: daysFromToday(0), members: [member(2, "Petr")] }),
    ],
  },
  {
    id: "l2",
    boardId: "b1",
    name: "Done",
    color: "success",
    position: 2,
    archived: false,
    cards: [
      card("c", { listId: "l2", members: [member(1, "Vojta")] }),
      card("d", { listId: "l2", dueDate: daysFromToday(5), members: [member(1, "Vojta")] }),
    ],
  },
];

const allMembers = [
  { id: 1, name: "Vojta", email: "v@x.cz" },
  { id: 2, name: "Petr", email: "p@x.cz" },
  { id: 3, name: "Nikdo", email: "n@x.cz" },
];

describe("parseBoardGroup", () => {
  it("whitelist + default list", () => {
    expect(parseBoardGroup(new URLSearchParams("group=due"))).toBe("due");
    expect(parseBoardGroup(new URLSearchParams("group=assignee"))).toBe("assignee");
    expect(parseBoardGroup(new URLSearchParams("group=nesmysl"))).toBe("list");
    expect(parseBoardGroup(new URLSearchParams())).toBe("list");
  });
});

describe("buildGroups — list", () => {
  it("1:1 se sloupci, droppable, dot z presetu", () => {
    const groups = buildGroups("list", lists, allMembers);
    expect(groups.map((g) => g.key)).toEqual(["l1", "l2"]);
    expect(groups[0]!.droppableListId).toBe("l1");
    expect(groups[0]!.dotColor).toBeTruthy();
  });
});

describe("buildGroups — due", () => {
  it("buckety v pořadí overdue/today/upcoming/none, prázdné vynechá, drag disabled", () => {
    const groups = buildGroups("due", lists, allMembers);
    expect(groups.map((g) => g.key)).toEqual([
      "due-overdue",
      "due-today",
      "due-upcoming",
      "due-none",
    ]);
    expect(groups.map((g) => g.cards.map((c) => c.id))).toEqual([
      ["a"],
      ["b"],
      ["d"],
      ["c"],
    ]);
    expect(groups.every((g) => g.droppableListId === null)).toBe(true);
  });
});

describe("buildGroups — assignee", () => {
  it("dle members[0] v pořadí allMembers, členové bez karet vynecháni, Nepřiřazeno poslední", () => {
    const groups = buildGroups("assignee", lists, allMembers);
    expect(groups.map((g) => g.label)).toEqual(["Vojta", "Petr", "Nepřiřazeno"]);
    expect(groups[0]!.cards.map((c) => c.id)).toEqual(["c", "d"]);
    expect(groups[2]!.cards.map((c) => c.id)).toEqual(["a"]);
  });

  it("člen karty mimo allMembers neztratí karty", () => {
    const withStranger: ListData[] = [
      { ...lists[0]!, cards: [card("x", { members: [member(99, "Bývalý")] })] },
    ];
    const groups = buildGroups("assignee", withStranger, allMembers);
    expect(groups.map((g) => g.label)).toEqual(["Bývalý"]);
  });
});
