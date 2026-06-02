import { describe, expect, it } from "vitest";
import {
  formatPersonShortName,
  getCalendarGlobalDeputyHeadline,
  getCalendarGlobalHeadline,
  getCalendarGlobalLabelWithDuration,
  getCalendarGlobalStatusLine,
  getCalendarGlobalTimeRange,
} from "./calendar-event-meta";

describe("calendar-event-meta global formatting", () => {
  it("formatPersonShortName – iniciála a příjmení", () => {
    expect(formatPersonShortName("Věra", "Burkertová")).toBe("V. Burkertová");
    expect(formatPersonShortName("", "Novák")).toBe("Novák");
  });

  it("getCalendarGlobalHeadline – jméno | typ", () => {
    expect(
      getCalendarGlobalHeadline({
        title: "Dovolená",
        event_type: "dovolena",
        users: { first_name: "Věra", last_name: "Burkertová" },
        users_deputy: null,
        deputy_id: null,
        approval_status: null,
      })
    ).toMatch(/V\. Burkertová \| Dovolená/);
  });

  it("getCalendarGlobalDeputyHeadline – zástup", () => {
    expect(
      getCalendarGlobalDeputyHeadline({
        event_type: "dovolena",
        users: { first_name: "Marie", last_name: "Paslerová" },
        users_deputy: { first_name: "Alena", last_name: "Sehnalová" },
        deputy_id: 1,
        approval_status: "approved",
      })
    ).toBe("A. Sehnalová | Zastupuje za: M. Paslerová");
  });

  it("getCalendarGlobalStatusLine – Schválen / Čeká", () => {
    expect(
      getCalendarGlobalStatusLine({ approval_status: "approved", deputy_id: 1 })
    ).toBe("Schválen");
    expect(
      getCalendarGlobalStatusLine({ approval_status: "pending", deputy_id: 1 })
    ).toBe("Čeká na schválení");
    expect(getCalendarGlobalStatusLine({ approval_status: null, deputy_id: null })).toBe(
      ""
    );
  });

  it("getCalendarGlobalTimeRange – od–do", () => {
    const start = new Date("2026-05-16T05:00:00.000Z");
    const end = new Date("2026-05-16T08:30:00.000Z");
    const range = getCalendarGlobalTimeRange(start, end);
    expect(range).toMatch(/\d{1,2}:\d{2} – \d{1,2}:\d{2}/);
  });

  it("getCalendarGlobalLabelWithDuration – jméno | typ + trvání", () => {
    const start = new Date("2026-06-25T22:00:00.000Z");
    const end = new Date("2026-07-07T21:59:59.999Z");
    const label = getCalendarGlobalLabelWithDuration({
      title: "Dovolená",
      event_type: "dovolena",
      start_date: start,
      end_date: end,
      users: { first_name: "Věra", last_name: "Burkertová" },
      users_deputy: null,
      deputy_id: null,
      approval_status: null,
    });
    expect(label).toMatch(/V\. Burkertová \| Dovolená /);
    expect(label).toMatch(/26/);
    expect(label).toMatch(/7/);
  });
});
