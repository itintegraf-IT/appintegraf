import { describe, expect, it } from "vitest";
import {
  formatVehicleApproverAssignmentNote,
  vehicleApproverTierLabel,
} from "./resource-vehicle-approver-resolution";

describe("vehicleApproverTierLabel", () => {
  it("vrátí český popisek", () => {
    expect(vehicleApproverTierLabel("primary")).toContain("primární");
  });
});

describe("formatVehicleApproverAssignmentNote", () => {
  it("bez přeskočených tierů", () => {
    expect(formatVehicleApproverAssignmentNote("Jan Novák", "primary", [])).toContain("Jan Novák");
  });

  it("s přeskočenými tiery", () => {
    const note = formatVehicleApproverAssignmentNote("Jan Novák", "secondary", ["primary"]);
    expect(note).toContain("nepřítomen");
  });
});
