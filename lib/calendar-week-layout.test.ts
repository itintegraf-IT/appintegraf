import { describe, expect, it } from "vitest";
import {
  computeAllDayWeekSpan,
  isMultiDayAllDay,
  layoutAllDaySpanRows,
  layoutWeekDayColumns,
  allDaySpanOverlayPercent,
  type WeekDayLayoutItem,
} from "./calendar-week-layout";
import {
  allDayEventDisplayDates,
  isAllDayEvent,
} from "@/app/(dashboard)/calendar/lib/event-types";
import {
  allDayYmdRangeToIsoStrings,
  buildWeekDayYmds,
} from "./datetime-cz";

function item(
  id: string,
  eventId: number,
  kind: "owner" | "deputy",
  startMs: number,
  endMs: number
): WeekDayLayoutItem {
  const pairId = `ev-${eventId}`;
  return { id, eventId, pairId, kind, startMs, endMs };
}

describe("calendar-week-layout", () => {
  it("jedna událost = jeden sloupec", () => {
    const layout = layoutWeekDayColumns([
      item("ev-1-owner", 1, "owner", 9 * 3600000, 10 * 3600000),
    ]);
    expect(layout.get("ev-1-owner")).toEqual({ column: 0, columnCount: 1 });
  });

  it("owner + deputy stejné události = dva sousední sloupce", () => {
    const layout = layoutWeekDayColumns([
      item("ev-1-owner", 1, "owner", 9 * 3600000, 11 * 3600000),
      item("ev-1-deputy", 1, "deputy", 9 * 3600000, 11 * 3600000),
    ]);
    expect(layout.get("ev-1-owner")).toEqual({ column: 0, columnCount: 2 });
    expect(layout.get("ev-1-deputy")).toEqual({ column: 1, columnCount: 2 });
  });

  it("dva nesouvisející překryvy = dva sloupce", () => {
    const layout = layoutWeekDayColumns([
      item("ev-1-owner", 1, "owner", 9 * 3600000, 11 * 3600000),
      item("ev-2-owner", 2, "owner", 9 * 3600000, 10 * 3600000),
    ]);
    expect(layout.get("ev-1-owner")).toEqual({ column: 0, columnCount: 2 });
    expect(layout.get("ev-2-owner")).toEqual({ column: 1, columnCount: 2 });
  });

  it("computeAllDayWeekSpan a isMultiDayAllDay", () => {
    const week = ["2026-05-26", "2026-05-27", "2026-05-28", "2026-05-29", "2026-05-30", "2026-05-31", "2026-06-01"];
    expect(computeAllDayWeekSpan(week, ["2026-05-27", "2026-05-28", "2026-05-29"])).toEqual({
      startIdx: 1,
      endIdx: 3,
    });
    expect(isMultiDayAllDay(["2026-05-27"])).toBe(false);
    expect(isMultiDayAllDay(["2026-05-27", "2026-05-28"])).toBe(true);
  });

  it("layoutAllDaySpanRows – dva překrývající se pruhy = dva řádky", () => {
    const layout = layoutAllDaySpanRows([
      { id: "ev-1-owner", startIdx: 1, endIdx: 4, kind: "owner" },
      { id: "ev-2-owner", startIdx: 2, endIdx: 5, kind: "owner" },
    ]);
    expect(layout.get("ev-1-owner")?.row).toBe(0);
    expect(layout.get("ev-2-owner")?.row).toBe(1);
    expect(layout.get("ev-1-owner")?.rowCount).toBe(2);
  });

  it("layoutAllDaySpanRows – owner + deputy stejné události = deputy pod ownerem", () => {
    const layout = layoutAllDaySpanRows([
      { id: "ev-1-owner", pairId: "ev-1", startIdx: 0, endIdx: 3, kind: "owner" },
      { id: "ev-1-deputy", pairId: "ev-1", startIdx: 0, endIdx: 3, kind: "deputy" },
    ]);
    expect(layout.get("ev-1-owner")).toEqual({ row: 0, rowCount: 2 });
    expect(layout.get("ev-1-deputy")).toEqual({ row: 1, rowCount: 2 });
  });

  it("layoutAllDaySpanRows – nesouvislé skupiny = globální offset řádků", () => {
    const layout = layoutAllDaySpanRows([
      { id: "ev-1-owner", pairId: "ev-1", startIdx: 0, endIdx: 2, kind: "owner" },
      { id: "ev-1-deputy", pairId: "ev-1", startIdx: 0, endIdx: 2, kind: "deputy" },
      { id: "ev-2-owner", pairId: "ev-2", startIdx: 4, endIdx: 4, kind: "owner" },
    ]);
    expect(layout.get("ev-1-owner")?.row).toBe(0);
    expect(layout.get("ev-1-deputy")?.row).toBe(1);
    expect(layout.get("ev-2-owner")?.row).toBe(2);
    expect(layout.get("ev-2-owner")?.rowCount).toBe(3);
  });

  it("jednodenní celodenní 15.10 se v posunutých týdnech mapuje jen na 15.10", () => {
    const { start, end } = allDayYmdRangeToIsoStrings("2026-10-15", "2026-10-15");
    const s = new Date(start);
    const e = new Date(end);
    expect(isAllDayEvent(s, e)).toBe(true);
    const dates = allDayEventDisplayDates(s, e);
    expect(dates).toEqual(["2026-10-15"]);
    expect(isMultiDayAllDay(dates)).toBe(false);

    for (const from of ["2026-10-09", "2026-10-10", "2026-10-14"]) {
      const week = buildWeekDayYmds(from);
      expect(week.filter((d) => dates.includes(d))).toEqual(["2026-10-15"]);
      for (const wrong of ["2026-10-11", "2026-10-12", "2026-10-16"]) {
        expect(dates.includes(wrong)).toBe(false);
      }
      expect(computeAllDayWeekSpan(week, dates)).toEqual({
        startIdx: week.indexOf("2026-10-15"),
        endIdx: week.indexOf("2026-10-15"),
      });
    }
  });

  it("allDaySpanOverlayPercent – čtvrtek v týdnu od středy = 2. sloupec", () => {
    // from=2026-10-14 → index 15.10 = 1 → left 1/7, width 1/7
    expect(allDaySpanOverlayPercent(1, 1)).toEqual({
      leftPct: (1 / 7) * 100,
      widthPct: (1 / 7) * 100,
    });
    expect(allDaySpanOverlayPercent(0, 2)).toEqual({
      leftPct: 0,
      widthPct: (3 / 7) * 100,
    });
  });
});
