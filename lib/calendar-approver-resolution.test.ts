import { describe, expect, it } from "vitest";
import { resolveApproverDepartmentId } from "./calendar-approver-resolution";

describe("resolveApproverDepartmentId", () => {
  it("vrátí hlavní oddělení", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: 5,
        user_secondary_departments: [{ department_id: 9 }],
      })
    ).toBe(5);
  });

  it("bez hlavního vrátí první sekundární", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: null,
        user_secondary_departments: [{ department_id: 9 }, { department_id: 12 }],
      })
    ).toBe(9);
  });

  it("bez oddělení vrátí null", () => {
    expect(
      resolveApproverDepartmentId({
        department_id: null,
        user_secondary_departments: [],
      })
    ).toBeNull();
  });
});
