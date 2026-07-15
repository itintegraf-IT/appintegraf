import { describe, expect, it } from "vitest";
import {
  calendarEditRequiresApprovalReset,
  deriveApprovalStatusFromApprovals,
  getEffectiveCalendarApprovalStatus,
  isStaleApprovalStatusMismatch,
  stripCalendarApprovalNotes,
} from "./calendar-approval-reset";

describe("stripCalendarApprovalNotes", () => {
  it("odstraní schvalovací řádky a ponechá uživatelský text", () => {
    const input = [
      "Důvod: osobní záležitost",
      "",
      "Schváleno zástupem dne 1. 6. 2026 (Petr Pavlišta)",
      "Předáno ke schválení: Petr Čejchan (primární schvalovatel).",
      "Schváleno schvalovatelem dne 1. 6. 2026 (Petr Čejchan)",
    ].join("\n");

    expect(stripCalendarApprovalNotes(input)).toBe("Důvod: osobní záležitost");
  });
});

describe("calendarEditRequiresApprovalReset", () => {
  const existing = {
    start_date: new Date("2026-07-14T00:00:00.000Z"),
    end_date: new Date("2026-07-14T23:59:59.999Z"),
    event_type: "osobni",
    deputy_id: 10,
    approval_status: "approved" as const,
  };

  it("nereaguje na změnu pouze názvu / popisu", () => {
    expect(
      calendarEditRequiresApprovalReset(existing, {
        start: existing.start_date,
        end: existing.end_date,
        eventType: "osobni",
        deputyIdNum: 10,
      })
    ).toBe(false);
  });

  it("vyžaduje reset při změně termínu schválené události", () => {
    expect(
      calendarEditRequiresApprovalReset(existing, {
        start: new Date("2026-07-15T00:00:00.000Z"),
        end: existing.end_date,
        eventType: "osobni",
        deputyIdNum: 10,
      })
    ).toBe(true);
  });

  it("vyžaduje reset při změně zástupu", () => {
    expect(
      calendarEditRequiresApprovalReset(existing, {
        start: existing.start_date,
        end: existing.end_date,
        eventType: "osobni",
        deputyIdNum: 11,
      })
    ).toBe(true);
  });
});

describe("deriveApprovalStatusFromApprovals", () => {
  it("plně schválená událost", () => {
    expect(
      deriveApprovalStatusFromApprovals(1, true, [
        { approval_type: "deputy", status: "approved" },
        { approval_type: "manager", status: "approved" },
      ])
    ).toBe("approved");
  });

  it("čeká na finálního schvalovatele", () => {
    expect(
      deriveApprovalStatusFromApprovals(1, true, [
        { approval_type: "deputy", status: "approved" },
        { approval_type: "manager", status: "pending" },
      ])
    ).toBe("deputy_approved");
  });

  it("čeká na zástupce", () => {
    expect(
      deriveApprovalStatusFromApprovals(1, true, [
        { approval_type: "deputy", status: "pending" },
      ])
    ).toBe("pending");
  });
});

describe("getEffectiveCalendarApprovalStatus", () => {
  it("opraví pending v DB když jsou schválení kompletní", () => {
    const event = {
      deputy_id: 1,
      requires_approval: true,
      approval_status: "pending" as const,
      start_date: new Date(),
      end_date: new Date(),
      event_type: "osobni",
    };
    const approvals = [
      { approval_type: "deputy", status: "approved" },
      { approval_type: "manager", status: "approved" },
    ];
    expect(getEffectiveCalendarApprovalStatus(event, approvals)).toBe("approved");
    expect(isStaleApprovalStatusMismatch("pending", "approved")).toBe(true);
  });
});
