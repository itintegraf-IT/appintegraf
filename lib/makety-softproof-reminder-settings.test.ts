import { describe, expect, it } from "vitest";
import {
  DEFAULT_SOFTPROOF_REMINDER_SETTINGS,
  parseSoftproofReminderSettings,
} from "@/lib/makety-softproof-reminder-settings";

describe("parseSoftproofReminderSettings", () => {
  it("vrátí default při prázdném vstupu", () => {
    expect(parseSoftproofReminderSettings(null)).toEqual(
      DEFAULT_SOFTPROOF_REMINDER_SETTINGS
    );
    expect(parseSoftproofReminderSettings("")).toEqual(
      DEFAULT_SOFTPROOF_REMINDER_SETTINGS
    );
  });

  it("parsuje zapnuté připomínky", () => {
    expect(
      parseSoftproofReminderSettings(
        JSON.stringify({ enabled: true, default_on_send: false })
      )
    ).toEqual({ enabled: true, default_on_send: false });
  });

  it("default_on_send je true pokud chybí", () => {
    expect(parseSoftproofReminderSettings(JSON.stringify({ enabled: true }))).toEqual({
      enabled: true,
      default_on_send: true,
    });
  });
});
