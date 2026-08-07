import { describe, expect, it } from "vitest";
import {
  JOB_NUMBER_REQUIRED_ERROR,
  normalizeJobNumber,
  requireJobNumberOrConfirm,
} from "./order-job-number";

describe("normalizeJobNumber", () => {
  it("trim a prázdné → null", () => {
    expect(normalizeJobNumber("  ABC-1  ")).toBe("ABC-1");
    expect(normalizeJobNumber("")).toBeNull();
    expect(normalizeJobNumber("   ")).toBeNull();
    expect(normalizeJobNumber(null)).toBeNull();
  });

  it("ořízne na 50 znaků", () => {
    const long = "x".repeat(60);
    expect(normalizeJobNumber(long)?.length).toBe(50);
  });
});

describe("requireJobNumberOrConfirm", () => {
  it("přijme vyplněné číslo", () => {
    const r = requireJobNumberOrConfirm({ job_number: " Z-100 " });
    expect(r).toEqual({ ok: true, jobNumber: "Z-100" });
  });

  it("odmítne prázdné bez potvrzení", () => {
    const r = requireJobNumberOrConfirm({ job_number: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toBe(JOB_NUMBER_REQUIRED_ERROR);
  });

  it("povolí null s confirmed_without_job_number", () => {
    expect(
      requireJobNumberOrConfirm({
        job_number: null,
        confirmed_without_job_number: true,
      })
    ).toEqual({ ok: true, jobNumber: null });
  });
});
