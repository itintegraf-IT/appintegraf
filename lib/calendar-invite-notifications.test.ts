import { describe, expect, it } from "vitest";
import { parseCalendarEventIdFromNotificationLink } from "./calendar-invite-notifications";

describe("parseCalendarEventIdFromNotificationLink", () => {
  it("parsuje odkaz na událost", () => {
    expect(parseCalendarEventIdFromNotificationLink("/calendar/42")).toBe(42);
    expect(parseCalendarEventIdFromNotificationLink("/calendar/42/edit")).toBe(42);
  });

  it("vrátí null pro neplatný odkaz", () => {
    expect(parseCalendarEventIdFromNotificationLink(null)).toBeNull();
    expect(parseCalendarEventIdFromNotificationLink("/calendar")).toBeNull();
  });
});
