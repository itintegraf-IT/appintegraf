import { describe, expect, it } from "vitest";
import { buildLabelMissingWhere, roomNeedsLabel } from "./label-filters";

describe("buildLabelMissingWhere", () => {
  it("bez štítku = s QR, nepotvrzený tisk, skupina se štítky, nevyřazené (i bez stavu)", () => {
    expect(buildLabelMissingWhere()).toEqual({
      qr_code: { not: null },
      label_printed_at: null,
      equipment_categories: { label_required: true },
      OR: [{ status: null }, { status: { not: "vyřazeno" } }],
    });
  });
});

describe("roomNeedsLabel", () => {
  it("aktivní místnost bez potvrzeného štítku potřebuje štítek", () => {
    expect(roomNeedsLabel({ is_active: true, label_printed_at: null })).toBe(true);
  });

  it("vytištěná nebo neaktivní ne", () => {
    expect(roomNeedsLabel({ is_active: true, label_printed_at: "2026-10-04T10:00:00.000Z" })).toBe(false);
    expect(roomNeedsLabel({ is_active: false, label_printed_at: null })).toBe(false);
  });
});
