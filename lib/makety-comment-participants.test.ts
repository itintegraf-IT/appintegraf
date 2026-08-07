import { describe, expect, it } from "vitest";
import {
  buildMaketyCommentParticipants,
  parseNotifyUserIds,
} from "@/lib/makety-comment-participants";

describe("makety-comment-participants", () => {
  it("sestaví role grafiky a vynechá autora", () => {
    const list = buildMaketyCommentParticipants({
      workType: "grafika",
      excludeUserId: 2,
      creator: { id: 1, first_name: "A", last_name: "Zadavatel" },
      assignee: { id: 2, first_name: "B", last_name: "Grafik" },
      prepress: { id: 3, first_name: "C", last_name: "Prepress" },
      finalApprover: { id: 4, first_name: "D", last_name: "Final" },
    });
    expect(list.map((p) => p.userId)).toEqual([1, 3, 4]);
    expect(list.find((p) => p.userId === 1)?.roleLabel).toBe("Zadavatel");
    expect(list.find((p) => p.userId === 3)?.roleLabel).toBe("Prepress");
  });

  it("u makety má jen zadavatele a výrobce", () => {
    const list = buildMaketyCommentParticipants({
      workType: "maketa",
      creator: { id: 1, first_name: "A", last_name: "Z" },
      assignee: { id: 5, first_name: "V", last_name: "Y" },
      prepress: { id: 3, first_name: "C", last_name: "P" },
    });
    expect(list.map((p) => p.role)).toEqual(["zadavatel", "assignee"]);
    expect(list[1]?.roleLabel).toBe("Výrobce");
  });

  it("parsuje notify IDs", () => {
    expect(parseNotifyUserIds([1, "2", 2, null, "x"])).toEqual([1, 2]);
  });
});
