import { describe, expect, it } from "vitest";
import { isAwaitingFinalApproval } from "./awaiting-final-approval";

describe("isAwaitingFinalApproval", () => {
  const clientAt = new Date("2026-01-10T12:00:00Z");
  const softAt = new Date("2026-01-09T12:00:00Z");

  it("true po client_approved ve sent_for_approval", () => {
    expect(
      isAwaitingFinalApproval({
        workType: "grafika",
        status: "sent_for_approval",
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient: false,
      })
    ).toBe(true);
  });

  it("false když softproof_sent je novější než client_approved", () => {
    expect(
      isAwaitingFinalApproval({
        workType: "grafika",
        status: "sent_for_approval",
        latestClientApprovedAt: softAt,
        latestSoftproofSentAt: clientAt,
        hasApprovedAfterClient: false,
      })
    ).toBe(false);
  });

  it("false po finálním approved", () => {
    expect(
      isAwaitingFinalApproval({
        workType: "grafika",
        status: "sent_for_approval",
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient: true,
      })
    ).toBe(false);
  });

  it("false pro jiný stav / typ", () => {
    expect(
      isAwaitingFinalApproval({
        workType: "maketa",
        status: "sent_for_approval",
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient: false,
      })
    ).toBe(false);
    expect(
      isAwaitingFinalApproval({
        workType: "grafika",
        status: "approved",
        latestClientApprovedAt: clientAt,
        latestSoftproofSentAt: softAt,
        hasApprovedAfterClient: false,
      })
    ).toBe(false);
  });
});
